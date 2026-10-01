import { spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import net from "node:net"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { parse } from "dotenv"
import pg from "pg"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const local = resolve(root, ".local")
const data = resolve(local, "postgres-data")
const redisData = resolve(local, "redis-data")
const socket = resolve(local, "redis.sock")
const redisBin = resolve(local, "redis-7.4.9/src")
const env = parse(readFileSync(resolve(root, ".env")))
const database = new URL(env.DATABASE_URL)
const redis = new URL(env.REDIS_URL)
for (const url of [database, redis]) {
  if (url.hostname !== "127.0.0.1")
    throw new Error("Local services require 127.0.0.1 URLs in .env.")
}
const bin = await import(`@embedded-postgres/${process.platform}-${process.arch}`)
for (const path of Object.values(bin)) {
  if (typeof path === "string" && existsSync(path)) chmodSync(path, 0o755)
}
const run = (file, args, quiet = false) => {
  const result = spawnSync(file, args, { cwd: root, encoding: "utf8" })
  if (!quiet && result.status !== 0)
    throw new Error(result.error?.message || result.stderr || result.stdout || `${file} failed`)
  return result
}
const pgRunning = () =>
  existsSync(resolve(data, "PG_VERSION")) &&
  run(bin.pg_ctl, ["-D", data, "status"], true).status === 0
const redisRunning = () =>
  existsSync(socket) &&
  run(resolve(redisBin, "redis-cli"), ["-s", socket, "PING"], true).stdout?.trim() === "PONG"
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function freePort(port) {
  await new Promise((ok, fail) => {
    const server = net.createServer()
    server.once("error", fail)
    server.listen(Number(port), "127.0.0.1", () => server.close(ok))
  })
}
async function start() {
  if (!existsSync(resolve(redisBin, "redis-server")))
    throw new Error("Run bun run services:install-redis first.")
  mkdirSync(local, { recursive: true })
  mkdirSync(redisData, { recursive: true })
  if (!pgRunning()) {
    await freePort(database.port)
    if (!existsSync(resolve(data, "PG_VERSION"))) {
      const passwordFile = resolve(local, "init-password")
      writeFileSync(passwordFile, decodeURIComponent(database.password) + "\n", { mode: 0o600 })
      try {
        run(bin.initdb, [
          "-D",
          data,
          "--username=" + decodeURIComponent(database.username),
          "--pwfile=" + passwordFile,
          "--auth=scram-sha-256",
          "--encoding=UTF8",
          "--locale=C",
        ])
      } finally {
        unlinkSync(passwordFile)
      }
    }
    // TCP loopback only; no system-wide Unix socket or service registration.
    run(bin.pg_ctl, [
      "-D",
      data,
      "-l",
      resolve(local, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${Number(database.port)} -c unix_socket_directories=''`,
      "-w",
      "start",
    ])
  }
  const adminUrl = new URL(database)
  adminUrl.pathname = "/postgres"
  const client = new pg.Client({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 5000,
  })
  try {
    await client.connect()
    const name = decodeURIComponent(database.pathname.slice(1))
    const result = await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [name])
    if (!result.rowCount) await client.query(`CREATE DATABASE ${client.escapeIdentifier(name)}`)
  } finally {
    await client.end()
  }
  if (!redisRunning()) {
    await freePort(redis.port)
    const config = resolve(local, "redis.conf")
    writeFileSync(
      config,
      [
        "bind 127.0.0.1",
        `port ${Number(redis.port)}`,
        "protected-mode yes",
        "daemonize yes",
        `dir ${JSON.stringify(redisData)}`,
        "appendonly yes",
        `pidfile ${JSON.stringify(resolve(local, "redis.pid"))}`,
        `logfile ${JSON.stringify(resolve(local, "redis.log"))}`,
        `unixsocket ${JSON.stringify(socket)}`,
        "unixsocketperm 700",
        "",
      ].join("\n"),
    )
    run(resolve(redisBin, "redis-server"), [config])
    for (let i = 0; i < 50 && !redisRunning(); i++) await wait(100)
    if (!redisRunning()) throw new Error("Redis did not start. Check .local/redis.log.")
  }
  status()
}
function stop() {
  if (redisRunning()) run(resolve(redisBin, "redis-cli"), ["-s", socket, "SHUTDOWN", "SAVE"])
  if (pgRunning()) run(bin.pg_ctl, ["-D", data, "-m", "fast", "-w", "stop"])
  status()
}
function status() {
  console.log(`PostgreSQL: ${pgRunning() ? "running" : "stopped"} (127.0.0.1:${database.port})`)
  console.log(`Redis: ${redisRunning() ? "running" : "stopped"} (127.0.0.1:${redis.port})`)
}
try {
  const command = process.argv[2]
  if (command === "start") await start()
  else if (command === "stop") stop()
  else if (command === "status") status()
  else throw new Error("Usage: bun scripts/local-services.mjs start|stop|status")
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}

# Project-local development on macOS

PostgreSQL is supplied by the pinned `embedded-postgres` development dependency in
`node_modules`. Redis 7.4.9 is built in `.local/redis-7.4.9` from its official source.
Neither server is installed globally or registered as a macOS startup service.

## Daily use

Run these commands from the repository folder:

```sh
bun run services:start
bun run dev
```

Open http://localhost:3000. Stop Next.js with Ctrl+C. The databases run separately;
stop them when finished:

```sh
bun run services:stop
```

The development and build commands explicitly use Webpack (`--webpack`) because
the existing MDX plugin options are incompatible with Turbopack, which became the
default in Next.js 16. The existing sponsor image
host is also allowed in `next.config.ts` so those cards can render.

Check their status with `bun run services:status`. Repeated start/stop commands are
safe. After restarting your Mac, run `services:start` again.

## Storage and connections

- PostgreSQL listens at `127.0.0.1:55432`.
- Redis listens at `127.0.0.1:56379`.
- `.env` contains the matching URLs and a generated PostgreSQL password.
- Persistent data lives in `.local/postgres-data` and `.local/redis-data`.
- Logs are `.local/postgres.log` and `.local/redis.log`.
- The previous `.env` was backed up to `.local/env.before-local-services`.
- `.local`, `.env`, and `node_modules` are excluded from Git.

Stopping services preserves data. Deleting `.local` deletes the local databases;
back up any data you want to keep first. Stop the services before moving the
project folder. Do not change the PostgreSQL package major version without a
database upgrade/export plan.

## Rebuilding Redis

Apple Command Line Tools are required (already present on this Mac).

```sh
bun run services:install-redis
```

This downloads and compiles Redis within `.local`; it does not run `make install`.
The downloaded archive is checked against the checksum recorded during setup.

## Database schema

The existing migrations and category seed were applied during setup. For future
existing migrations, run `bun run db:migrate` while the services are running.
You do not need to run `db:generate` or `db:push` each time you start the app.

## External integrations

This Mac's `.env` enables `NEXT_PUBLIC_LOCAL_AUTH=true`. With `bun run dev`, this
allows email/password signup and login without CAPTCHA, email verification, or
Stripe customer creation. Signup opens the dashboard directly. Google/GitHub
buttons are disabled in this mode. Password reset emails, payments, and uploads
still require real service settings.

The local auth setting is ignored in production (`next build` / `next start`);
production retains CAPTCHA, email verification, and Stripe integration. Set the
flag to `false` and configure the services when testing those integrations locally.

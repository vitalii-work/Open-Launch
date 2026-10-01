#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
version=7.4.9
archive=".local/downloads/redis-$version.tar.gz"
mkdir -p .local/downloads .local/redis-data
if [ ! -f "$archive" ]; then
  curl -fL "https://download.redis.io/releases/redis-$version.tar.gz" -o "$archive"
fi
echo "a71a67b47b2705d3448f0400573e3ad5c4c9f8c18236f426dc6acc7284bf42ad  $archive" | shasum -a 256 -c -
if [ ! -d ".local/redis-$version" ]; then
  tar -xzf "$archive" -C .local
fi
make -C ".local/redis-$version" -j4 BUILD_TLS=no
echo "Redis built inside .local/redis-$version; nothing installed globally."

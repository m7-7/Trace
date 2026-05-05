#!/bin/sh
set -e

echo "Applying database migrations..."
node dist/migrate.js || true

echo "Starting Trace..."
exec node dist/index.js

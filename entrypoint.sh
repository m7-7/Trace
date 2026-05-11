#!/bin/sh
set -e

mkdir -p /app/data

echo "Applying database migrations..."
node dist/migrate.js

echo "Starting Trace..."
exec node dist/index.js

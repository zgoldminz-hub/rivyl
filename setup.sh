#!/bin/bash
set -e

echo "=== Rivyl Setup ==="

# Check dependencies
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: Docker is required. Install from https://docker.com"; exit 1; }

# Install pnpm if needed
if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  npm install -g pnpm
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Start Postgres via Docker
echo "Starting Postgres..."
docker rm -f rivyl-db 2>/dev/null || true
docker run -d --name rivyl-db \
  -e POSTGRES_USER=rivyl_user \
  -e POSTGRES_PASSWORD=rivyl_pass \
  -e POSTGRES_DB=rivyl \
  -p 5432:5432 postgres:15

# Wait for Postgres to be ready
echo "Waiting for Postgres to be ready..."
sleep 4

# Copy env files if not present
[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env
[ -f apps/web/.env ] || cp apps/web/.env.example apps/web/.env

# Run migrations
echo "Running database migrations..."
cd apps/api && npx prisma migrate dev --name init && cd ../..

echo ""
echo "=== Setup complete! ==="
echo "Starting dev servers..."
echo ""
echo "  Web app: http://localhost:5173"
echo "  API:     http://localhost:4000"
echo ""
pnpm dev

#!/bin/bash
set -e

echo ""
echo "======================================"
echo "  Rivyl — One-Command Setup"
echo "======================================"
echo ""

# ── Node.js ───────────────────────────────
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "→ Download it from https://nodejs.org and re-run this script."
  exit 1
fi
echo "✓ Node.js $(node -v)"

# ── pnpm ──────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  # Add pnpm to PATH for the rest of this script
  export PNPM_HOME="$HOME/.local/share/pnpm"
  export PATH="$PNPM_HOME:$PATH"
fi

if ! command -v pnpm &>/dev/null; then
  # Fallback: find it via npm prefix
  NPM_PREFIX=$(npm config get prefix)
  export PATH="$NPM_PREFIX/bin:$PATH"
fi

echo "✓ pnpm $(pnpm -v)"

# ── Docker (for Postgres) ─────────────────
if ! command -v docker &>/dev/null; then
  echo ""
  echo "ERROR: Docker is not installed."
  echo "→ Download it from https://docker.com, start Docker Desktop, then re-run."
  exit 1
fi

if ! docker info &>/dev/null; then
  echo ""
  echo "ERROR: Docker is installed but not running."
  echo "→ Open Docker Desktop and wait for it to start, then re-run."
  exit 1
fi
echo "✓ Docker is running"

# ── Install dependencies ──────────────────
echo ""
echo "Installing dependencies..."
pnpm install

# ── Postgres via Docker ───────────────────
echo ""
echo "Starting Postgres..."
docker rm -f rivyl-db 2>/dev/null || true
docker run -d --name rivyl-db \
  -e POSTGRES_USER=rivyl_user \
  -e POSTGRES_PASSWORD=rivyl_pass \
  -e POSTGRES_DB=rivyl \
  -p 5432:5432 \
  postgres:15 >/dev/null

echo "Waiting for Postgres to be ready..."
for i in {1..15}; do
  if docker exec rivyl-db pg_isready -U rivyl_user -q 2>/dev/null; then
    break
  fi
  sleep 1
done
echo "✓ Postgres is ready"

# ── Env files ─────────────────────────────
if [ ! -f apps/api/.env ]; then
  cat > apps/api/.env << 'ENV'
DATABASE_URL="postgresql://rivyl_user:rivyl_pass@localhost:5432/rivyl"
JWT_ACCESS_SECRET="rivyl-access-secret-change-in-prod-xK9mP2qL"
JWT_REFRESH_SECRET="rivyl-refresh-secret-change-in-prod-nW7vR4jY"
JWT_ACCESS_EXPIRES="15m"
JWT_REFRESH_EXPIRES="30d"
STRIPE_SECRET_KEY="sk_test_placeholder"
STRIPE_WEBHOOK_SECRET="whsec_placeholder"
PORT=4000
CLIENT_URL="http://localhost:5173"
ENV
  echo "✓ Created apps/api/.env"
fi

# ── Database migrations ───────────────────
echo ""
echo "Running database migrations..."
cd apps/api && npx prisma migrate deploy && cd ../..
echo "✓ Database is up to date"

# ── Done ──────────────────────────────────
echo ""
echo "======================================"
echo "  Setup complete! Starting Rivyl..."
echo "======================================"
echo ""
echo "  Web app → http://localhost:5173"
echo "  API     → http://localhost:4000"
echo ""
echo "  Press Ctrl+C to stop."
echo ""

pnpm dev

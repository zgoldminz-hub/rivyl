#!/bin/bash
set -euo pipefail

# Only run in remote/web environment
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo '{"async": true, "asyncTimeout": 300000}'

cd "$CLAUDE_PROJECT_DIR"

# Install all dependencies
pnpm install --frozen-lockfile

# Generate Prisma client
cd apps/api && pnpm prisma generate && cd ../..

# Start API server in background
nohup bash -c 'cd "$CLAUDE_PROJECT_DIR/apps/api" && pnpm dev' > /tmp/api.log 2>&1 &
echo "API server starting..."

# Start web server in background (with --host to expose on network)
nohup bash -c 'cd "$CLAUDE_PROJECT_DIR/apps/web" && pnpm dev --host' > /tmp/web.log 2>&1 &
echo "Web server starting..."

echo "Session start complete. Servers starting in background."

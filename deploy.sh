#!/usr/bin/env bash
#
# One-command deploy to the Lightsail instance.
#
# It syncs the project to the instance, builds the Docker image there (so the
# Vite build args get baked in), and (re)starts the nginx container on port 8080.
# Host nginx on the instance terminates HTTPS on 443 and proxies to 8080.
#
# Prerequisites on the instance (one-time, see README): Docker installed and the
# login user added to the `docker` group.
#
# Usage:
#   cp .env.deploy.example .env.deploy   # then fill it in
#   ./deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE=".env.deploy"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.deploy.example to .env.deploy and fill it in." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Fail loudly if any required value is missing (no silent fallbacks).
for var in DEPLOY_SSH_HOST DEPLOY_REMOTE_DIR \
           VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY \
           VITE_LINEAR_CLIENT_ID VITE_LINEAR_REDIRECT_URI; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: $var is not set in $ENV_FILE" >&2
    exit 1
  fi
done

IMAGE_NAME="ganttsmart:latest"
CONTAINER_NAME="ganttsmart"

echo "==> Ensuring remote directory exists: ${DEPLOY_SSH_HOST}:${DEPLOY_REMOTE_DIR}"
ssh "$DEPLOY_SSH_HOST" "mkdir -p '${DEPLOY_REMOTE_DIR}'"

echo "==> Syncing project source to the instance"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude '.env.deploy' \
  --exclude '.env.docker' \
  ./ "${DEPLOY_SSH_HOST}:${DEPLOY_REMOTE_DIR}/"

# Ship the build-time vars in a small env file the remote build sources.
# These are public client values (already visible in the shipped bundle).
echo "==> Sending build configuration"
TMP_ENV="$(mktemp)"
trap 'rm -f "$TMP_ENV"' EXIT
cat > "$TMP_ENV" <<EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
VITE_LINEAR_CLIENT_ID=${VITE_LINEAR_CLIENT_ID}
VITE_LINEAR_REDIRECT_URI=${VITE_LINEAR_REDIRECT_URI}
VITE_SKIP_LANDING=${VITE_SKIP_LANDING:-false}
EOF
scp -q "$TMP_ENV" "${DEPLOY_SSH_HOST}:${DEPLOY_REMOTE_DIR}/.env.docker"

echo "==> Building image and restarting container on the instance"
# Simple/safe values (dir, names) are expanded locally; the build-arg values are
# read from .env.docker on the remote to avoid SSH quoting issues.
ssh "$DEPLOY_SSH_HOST" bash -s <<REMOTE
set -euo pipefail
cd "${DEPLOY_REMOTE_DIR}"

set -a
. ./.env.docker
set +a

docker build \\
  --build-arg VITE_SUPABASE_URL="\$VITE_SUPABASE_URL" \\
  --build-arg VITE_SUPABASE_ANON_KEY="\$VITE_SUPABASE_ANON_KEY" \\
  --build-arg VITE_LINEAR_CLIENT_ID="\$VITE_LINEAR_CLIENT_ID" \\
  --build-arg VITE_LINEAR_REDIRECT_URI="\$VITE_LINEAR_REDIRECT_URI" \\
  --build-arg VITE_SKIP_LANDING="\$VITE_SKIP_LANDING" \\
  -t ${IMAGE_NAME} .

if [ -n "\$(docker ps -aq -f name="^${CONTAINER_NAME}\$")" ]; then
  docker rm -f ${CONTAINER_NAME}
fi

docker run -d \\
  --name ${CONTAINER_NAME} \\
  --restart unless-stopped \\
  -p 8080:80 \\
  ${IMAGE_NAME}

docker image prune -f
REMOTE

echo "==> Done. App container is on :8080 (host nginx should proxy https://gantt.agencyrobotics.com)."

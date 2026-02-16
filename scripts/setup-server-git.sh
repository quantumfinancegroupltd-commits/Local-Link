#!/usr/bin/env bash
# One-time: make the app directory on EC2 a real git clone so redeploy-ssh.sh can git pull.
# Run from your Mac (replace REPO_URL with your real GitHub URL):
#   REPO_URL=https://github.com/quantumfinancegroupltd-commits/Local-Link.git ./scripts/setup-server-git.sh
#
# Or run the commands manually over SSH (see docs/EC2_DOMAIN_SETUP.md).

set -e

REPO_URL="${REPO_URL:-https://github.com/quantumfinancegroupltd-commits/Local-Link.git}"
KEY="${LOCALLINK_PEM:-$HOME/Downloads/LocalLink.pem}"
HOST="${LOCALLINK_HOST:-18.130.159.10}"
USER="${LOCALLINK_SSH_USER:-ec2-user}"
REPO_DIR="/home/ec2-user/LocalLink"

if [[ ! -f "$KEY" ]]; then
  echo "Key not found: $KEY"
  exit 1
fi

echo "This will: backup $REPO_DIR, clone $REPO_URL into it, then docker compose up."
echo "Any existing .env or custom config in the dir should be restored manually from the backup."
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[yY] ]]; then
  exit 0
fi

ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$HOST" "set -e
  cd /home/ec2-user
  if [ -d LocalLink ]; then
    echo 'Backing up LocalLink to LocalLink.bak...'
    rm -rf LocalLink.bak
    mv LocalLink LocalLink.bak
  fi
  echo 'Cloning repo...'
  git clone $REPO_URL LocalLink
  cd LocalLink
  git checkout main
  echo 'Copying .env from backup if present...'
  [ -f ../LocalLink.bak/.env ] && cp ../LocalLink.bak/.env .env || true
  echo 'Building and starting containers...'
  docker compose -f docker-compose.selfhost.yml up -d --build
  echo 'Done. You can delete LocalLink.bak later if everything looks good.'
"

echo "Server is now a git clone. Use ./scripts/redeploy-ssh.sh for future deploys."

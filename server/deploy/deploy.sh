#!/usr/bin/env bash
set -euo pipefail
sha="${1:?Commit SHA required}"
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid release SHA" >&2; exit 2; }
base=/home/ubuntu/ceetool-payments
release="$base/releases/$sha"
test -x "$release/runtime/node"
test -f "$release/server/src/index.mjs"
if [ "$(uname -m)" != "x86_64" ]; then
    echo "The bundled runtime requires x86_64." >&2
    exit 1
fi
chmod 700 "$base"
if [ ! -f "$base/.env" ]; then
    install -m 600 "$release/server/.env.example" "$base/.env"
fi
chmod 600 "$base/.env"
for entry in DB_HOST=localhost DB_USER=ceetool_user DB_PASS= DB_NAME=ceetool_payments; do
    key="${entry%%=*}"
    if ! grep -q "^${key}=" "$base/.env"; then
        printf '\n%s\n' "$entry" >> "$base/.env"
    fi
done
previous=""
if [ -L "$base/current" ]; then
    previous="$(readlink -f "$base/current")"
elif [ -e "$base/current" ]; then
    echo "Refusing to replace a non-symlink payment release pointer." >&2
    exit 1
fi
if [ -n "$previous" ] && ! grep -Fq 'mysql2/promise' "$previous/server/src/database.mjs"; then
    echo "The existing release must already use MySQL before deploying this version." >&2
    exit 1
fi
# Check MySQL before stopping the existing service.
"$release/runtime/node" --env-file="$base/.env" "$release/server/src/database.mjs"
rollback() {
    echo "Payment deployment failed." >&2
    if [ -n "$previous" ] && [ -d "$previous" ] && [ "$previous" != "$release" ]; then
        ln -sfnT "$previous" "$base/rollback-$sha"
        mv -Tf "$base/rollback-$sha" "$base/current"
        sudo install -m 644 "$previous/server/deploy/ceetool-payments.service" /etc/systemd/system/ceetool-payments.service
        sudo systemctl daemon-reload
        sudo systemctl restart ceetool-payments
    fi
}
trap 'rollback; exit 1' ERR
sudo systemctl stop ceetool-payments
ln -sfnT "$release" "$base/current-$sha"
mv -Tf "$base/current-$sha" "$base/current"
sudo install -m 644 "$release/server/deploy/ceetool-payments.service" /etc/systemd/system/ceetool-payments.service
sudo systemctl daemon-reload
sudo systemctl enable ceetool-payments
sudo systemctl restart ceetool-payments
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 2 --max-time 5 \
    http://127.0.0.1:3888/api/payments/health
printf '\n'
sudo "$release/runtime/node" "$release/server/deploy/install-nginx.mjs"
trap - ERR
if ! "$release/runtime/node" --env-file="$base/.env" "$release/server/src/reconcile.mjs"; then
    echo "Payment receipt reconciliation is incomplete. Inspect reconciliation logs before retrying after at least one minute." >&2
fi
"$release/runtime/node" --env-file="$base/.env" "$release/server/src/email.mjs" --status
"$release/runtime/node" "$release/server/deploy/install-nginx.mjs" --prune "$release" "$previous"

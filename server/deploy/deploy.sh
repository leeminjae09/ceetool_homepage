#!/usr/bin/env bash
set -euo pipefail
sha="${1:?Commit SHA required}"
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid release SHA" >&2; exit 2; }
base=/home/ubuntu/ceetool-payments
release="$base/releases/$sha"
test -x "$release/runtime/node"
test -f "$release/server/src/index.mjs"
if [ "$(uname -m)" != "x86_64" ]; then
    echo "The bundled runtime requires x86_64. Build a runtime matching this host before deploying." >&2
    exit 1
fi
mkdir -p "$base/data"
chmod 700 "$base" "$base/data"
if [ ! -f "$base/.env" ]; then
    install -m 600 "$release/server/.env.example" "$base/.env"
    echo "Created empty payment settings. Configure MID, Merchant Key, Google OAuth and administrator emails on the server."
fi
chmod 600 "$base/.env"
previous=""
if [ -L "$base/current" ]; then
    previous="$(readlink -f "$base/current")"
elif [ -e "$base/current" ]; then
    echo "Refusing to replace a non-symlink payment release pointer." >&2
    exit 1
fi
ln -sfnT "$release" "$base/current-$sha"
mv -Tf "$base/current-$sha" "$base/current"
rollback() {
    echo "Payment deployment failed; restoring the previous payment release if present." >&2
    if [ -n "$previous" ] && [ -d "$previous" ] && [ "$previous" != "$release" ]; then
        ln -sfnT "$previous" "$base/rollback-$sha"
        mv -Tf "$base/rollback-$sha" "$base/current"
        sudo systemctl restart ceetool-payments
    else
        sudo systemctl stop ceetool-payments
    fi
}
trap 'rollback; exit 1' ERR
sudo install -m 644 "$release/server/deploy/ceetool-payments.service" /etc/systemd/system/ceetool-payments.service
sudo install -m 644 "$release/server/deploy/ceetool-payments-backup.service" /etc/systemd/system/ceetool-payments-backup.service
sudo install -m 644 "$release/server/deploy/ceetool-payments-backup.timer" /etc/systemd/system/ceetool-payments-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable ceetool-payments
sudo systemctl restart ceetool-payments
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 2 --max-time 5 \
    http://127.0.0.1:3888/api/payments/health
printf '\n'
sudo "$release/runtime/node" "$release/server/deploy/install-nginx.mjs"
sudo systemctl enable --now ceetool-payments-backup.timer
sudo systemctl start ceetool-payments-backup.service
trap - ERR
# Keep the active release and two previous, explicitly SHA-named release directories.
"$release/runtime/node" "$release/server/deploy/install-nginx.mjs" --prune "$release" "$previous"

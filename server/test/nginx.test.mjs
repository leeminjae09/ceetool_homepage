import test from "node:test";
import assert from "node:assert/strict";
import { addInclude } from "../deploy/install-nginx.mjs";

test("nginx installer scopes changes to CEETOOL and is idempotent", () => {
  const original = `
server { listen 80; server_name other.example; root /var/www/other; }
server {
  listen 443 ssl;
  server_name ceetool.com www.ceetool.com;
  root /home/ubuntu/ceetool_homepage/dist;
  location / { try_files $uri $uri/ /index.html; }
}
server { listen 80; server_name ceetool.com; return 301 https://$host$request_uri; }
`;
  const updated = addInclude(original);
  assert.equal(updated.found, true);
  assert.equal(
    updated.content.match(
      /include \/etc\/nginx\/snippets\/ceetool-payments.conf;/g,
    ).length,
    1,
  );
  assert.ok(
    updated.content.includes("server_name other.example; root /var/www/other;"),
  );
  assert.ok(updated.content.includes("server_name ceetool.com; return 301"));
  assert.deepEqual(addInclude(updated.content), updated);
});
test("nginx installer handles quoted braces, comments and nested location roots", () => {
  const original = `
# server { server_name ceetool.com; root /home/ubuntu/ceetool_homepage/dist; }
server {
  server_name "ceetool.com";
  location / { root "/home/ubuntu/ceetool_homepage/dist"; }
  location ~ "^/a{2}" { return 404; }
}
`;
  const result = addInclude(original);
  assert.equal(result.found, true);
  assert.equal(
    result.content.match(
      /include \/etc\/nginx\/snippets\/ceetool-payments.conf;/g,
    ).length,
    1,
  );
});
test("nginx installer refuses to assume a different root belongs to this application", () => {
  const content =
    "server { server_name ceetool.com; root /var/www/another-app; }";
  assert.deepEqual(addInclude(content), { content, found: false });
});

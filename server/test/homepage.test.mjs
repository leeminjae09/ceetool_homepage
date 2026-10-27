import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { Readable } from "node:stream";
import { access, readFile } from "node:fs/promises";
import express from "express";
import {
  mountHomepage,
  validateContent,
  matchesMediaType,
  HomepageError,
  MEDIA_BASE,
  MAX_UPLOAD_BYTES,
} from "../src/homepage.mjs";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
function content() {
  return {
    categories: [
      {
        id: "payments",
        icon: "payment",
        visible: true,
        featured: false,
        title: "결제 시스템",
        tagline: "결제부터 정산까지",
        features: ["카드·해외 결제"],
        slides: [
          {
            label: "결제",
            project: {
              name: "C9Pro",
              description: "카드·USDT·PayPal·멤버십 연동",
              url: "https://c9-pro.com/",
              portfolioId: "c9pro",
            },
          },
          {
            label: "플러그인",
            project: {
              name: "ForYouPay",
              description: "우커머스 통합결제 플러그인",
            },
          },
        ],
      },
    ],
  };
}
test("homepage validates two linked slides, HTTPS links, unique IDs and bounded storage", () => {
  assert.deepEqual(validateContent(content()), content());
  for (const change of [
    (v) => {
      v.categories[0].slides.pop();
    },
    (v) => {
      v.categories.push(v.categories[0]);
    },
    (v) => {
      v.categories[0].slides[0].project.url = "javascript:alert(1)";
    },
    (v) => {
      v.categories[0].slides[0].media = {
        type: "image",
        alt: "unsafe",
        src: "https://other.invalid/file.svg",
      };
    },
    (v) => {
      v.categories[0].features = [];
    },
    (v) => {
      v.categories[0].visible = "false";
    },
    (v) => {
      v.categories[0].icon = "unknown";
    },
  ]) {
    const invalid = content();
    change(invalid);
    assert.throws(() => validateContent(invalid), HomepageError);
  }
  const many = content();
  many.categories = Array.from({ length: 24 }, (_, i) => {
    const category = structuredClone(many.categories[0]);
    category.id = `category-${i}`;
    category.features = Array(6).fill("한".repeat(150));
    return category;
  });

  assert.throws(() => validateContent(many), /너무 큽니다/);
  assert.deepEqual(validateContent({ categories: [] }), { categories: [] });
});

test("upload limit accepts exactly 100MB and rejects 100MB plus one byte", async (t) => {
  const f = await fixture(t, {
    uploadMedia: async (file) => {
      assert.equal(file.size, MAX_UPLOAD_BYTES);
      return `${MEDIA_BASE}/projects/homepage/boundary.png`;
    },
  });
  async function send(size) {
    const boundary = "ceetool-upload-boundary";
    const chunk = Buffer.alloc(1024 * 1024);
    async function* body() {
      yield Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="boundary.png"\r\nContent-Type: image/png\r\n\r\n`,
      );
      yield png;
      let remaining = size - png.length;
      while (remaining > 0) {
        const length = Math.min(remaining, chunk.length);
        yield chunk.subarray(0, length);
        remaining -= length;
      }
      yield Buffer.from(`\r\n--${boundary}--\r\n`);
    }
    return fetch(`${f.base}/admin/homepage/media`, {
      method: "POST",
      headers: {
        ...f.headers,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: Readable.from(body()),
      duplex: "half",
    });
  }
  assert.equal((await send(MAX_UPLOAD_BYTES)).status, 201);
  assert.equal((await send(MAX_UPLOAD_BYTES + 1)).status, 413);
});
test("homepage permits uploaded images and videos with optional posters, but not active content", () => {
  const value = content();
  value.categories[0].slides[0].media = {
    type: "video",
    src: `${MEDIA_BASE}/projects/homepage/test.mp4`,
    alt: "시연",
  };
  assert.equal(
    validateContent(value).categories[0].slides[0].media.type,
    "video",
  );
  assert.ok(matchesMediaType(png, "image/png"));
  assert.ok(matchesMediaType(Buffer.from([255, 216, 255, 1]), "image/jpeg"));
  assert.ok(matchesMediaType(Buffer.from("GIF89a"), "image/gif"));
  assert.ok(matchesMediaType(Buffer.from("RIFF0000WEBP"), "image/webp"));
  assert.ok(matchesMediaType(Buffer.from("0000ftypisom"), "video/mp4"));
  assert.ok(
    matchesMediaType(
      Buffer.concat([Buffer.from([26, 69, 223, 163]), Buffer.from("webm")]),
      "video/webm",
    ),
  );
  assert.equal(
    matchesMediaType(Buffer.from("<svg onload='alert(1)'>"), "image/png"),
    false,
  );
  assert.equal(
    matchesMediaType(Buffer.from("0000ftypqt  "), "video/mp4"),
    false,
  );
  assert.equal(matchesMediaType(png, "image/svg+xml"), false);
});
async function fixture(t, options = {}) {
  let saved;
  const db = {
    async get() {
      return saved ? { value: saved } : undefined;
    },
    async run(sql, ...params) {
      if (sql.startsWith("INSERT") && !saved) saved = params[1];
      if (sql.startsWith("UPDATE")) saved = params[0];
    },
    async transaction(fn) {
      return fn();
    },
  };
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  const requireHeader = (header, expected) => (req, res, next) => {
    if (req.headers[header] !== expected)
      return res
        .status(header === "cookie" ? 401 : 403)
        .json({ error: "forbidden" });
    next();
  };
  mountHomepage(app, {
    db,
    admin: requireHeader("cookie", "admin=test"),
    csrf: requireHeader("x-csrf-token", "test"),
    sameOrigin: requireHeader("origin", "https://ceetool.com"),
    logger: { error() {} },
    uploadMedia:
      options.uploadMedia ??
      (async () => `${MEDIA_BASE}/projects/homepage/test.png`),
  });
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ error: err.message });
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/payments`;
  const headers = {
    Cookie: "admin=test",
    Origin: "https://ceetool.com",
    "X-CSRF-Token": "test",
  };
  return { base, headers };
}
test("homepage routes authenticate writes, preserve revisions and hide unpublished categories", async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await (await fetch(`${f.base}/homepage`)).json(), {
    revision: null,
    content: null,
  });
  assert.equal((await fetch(`${f.base}/admin/homepage`)).status, 401);
  const put = (body, headers = f.headers) =>
    fetch(`${f.base}/admin/homepage`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await put(
        { content: content(), revision: null },
        { Cookie: "admin=test", Origin: "https://ceetool.com" },
      )
    ).status,
    403,
  );
  const first = await put({ content: content(), revision: null });
  assert.equal(first.status, 200);
  const saved = await first.json();
  assert.equal((await put({ content: content(), revision: null })).status, 409);
  const hidden = content();
  hidden.categories[0].visible = false;
  assert.equal(
    (await put({ content: hidden, revision: saved.revision })).status,
    200,
  );
  assert.equal(
    (await (await fetch(`${f.base}/homepage`)).json()).content.categories
      .length,
    0,
  );
  assert.equal(
    (
      await (
        await fetch(`${f.base}/admin/homepage`, { headers: f.headers })
      ).json()
    ).content.categories.length,
    1,
  );
});
test("uploads validate bytes, stream to storage, clean temporary files and surface storage failures", async (t) => {
  let path;
  const f = await fixture(t, {
    uploadMedia: async (file) => {
      path = file.path;
      assert.deepEqual(await readFile(file.path), png);
      return `${MEDIA_BASE}/projects/homepage/test.png`;
    },
  });
  const upload = (bytes, mime, headers = f.headers) => {
    const body = new FormData();
    body.append("file", new Blob([bytes], { type: mime }), "picture.png");
    return fetch(`${f.base}/admin/homepage/media`, {
      method: "POST",
      headers,
      body,
    });
  };
  assert.equal(
    (await upload(png, "image/png", { Origin: "https://ceetool.com" })).status,
    401,
  );
  assert.equal(
    (
      await upload(png, "image/png", {
        Cookie: "admin=test",
        Origin: "https://other.invalid",
        "X-CSRF-Token": "test",
      })
    ).status,
    403,
  );
  assert.equal((await upload(png, "image/png")).status, 201);
  await assert.rejects(access(path));
  assert.equal(
    (await upload(Buffer.from("<script>bad</script>"), "image/png")).status,
    400,
  );
  assert.equal((await upload(png, "image/svg+xml")).status, 400);
  assert.equal((await upload(Buffer.alloc(0), "image/png")).status, 400);
  const failed = await fixture(t, {
    uploadMedia: async () => {
      throw new Error("AccessDenied");
    },
  });
  const body = new FormData();
  body.append("file", new Blob([png], { type: "image/png" }), "picture.png");
  assert.equal(
    (
      await fetch(`${failed.base}/admin/homepage/media`, {
        method: "POST",
        headers: failed.headers,
        body,
      })
    ).status,
    503,
  );
});

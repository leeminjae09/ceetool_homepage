import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { API_PATH } from "./config.mjs";

export const MEDIA_BASE = "https://d2fgd6q9oovwa9.cloudfront.net";
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const key = "homepage_v1";
const icons = [
  "shopping",
  "payment",
  "ai",
  "marketing",
  "automation",
  "finance",
];
const formats = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export class HomepageError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function check(condition, message) {
  if (!condition) throw new HomepageError(400, message);
}
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function text(value, max, label, empty = false) {
  check(
    typeof value === "string" && value.length <= max && (empty || value.trim()),
    `${label}을(를) 확인해 주세요.`,
  );
  return value.trim();
}
function url(value, media = false) {
  const result = text(value, 2048, "주소");
  let parsed;
  try {
    parsed = new URL(result);
  } catch {
    throw new HomepageError(400, "올바른 HTTPS 주소를 입력해 주세요.");
  }
  check(
    parsed.protocol === "https:" && !parsed.username && !parsed.password,
    "HTTPS 주소만 사용할 수 있습니다.",
  );
  if (media)
    check(
      parsed.origin === MEDIA_BASE &&
        /^\/projects\/[A-Za-z0-9_./-]+$/.test(parsed.pathname) &&
        !parsed.search &&
        !parsed.hash,
      "업로드한 미디어 주소만 사용할 수 있습니다.",
    );
  return parsed.href;
}
export function validateContent(value) {
  check(
    record(value) &&
      Array.isArray(value.categories) &&
      value.categories.length <= 24,
    "카테고리는 최대 24개까지 설정할 수 있습니다.",
  );
  const ids = new Set();
  const categories = value.categories.map((category) => {
    check(record(category), "카테고리 정보를 확인해 주세요.");
    const id = text(category.id, 64, "카테고리 ID");
    check(
      /^[A-Za-z0-9_-]+$/.test(id) && !ids.has(id),
      "카테고리 ID가 중복되거나 올바르지 않습니다.",
    );
    ids.add(id);
    check(
      icons.includes(category.icon) &&
        typeof category.visible === "boolean" &&
        typeof category.featured === "boolean",
      "아이콘과 노출 설정을 확인해 주세요.",
    );
    check(
      Array.isArray(category.features) &&
        category.features.length >= 1 &&
        category.features.length <= 6,
      "기능은 1~6줄로 입력해 주세요.",
    );
    check(
      Array.isArray(category.slides) && category.slides.length === 2,
      "카테고리마다 슬라이드 2개를 설정해 주세요.",
    );
    return {
      id,
      icon: category.icon,
      visible: category.visible,
      featured: category.featured,
      title: text(category.title, 40, "카테고리명"),
      tagline: text(category.tagline, 150, "한 줄 소개"),
      features: category.features.map((feature) => text(feature, 150, "기능")),
      slides: category.slides.map((slide) => {
        check(
          record(slide) && record(slide.project),
          "슬라이드 정보를 확인해 주세요.",
        );
        const project = {
          name: text(slide.project.name, 100, "프로젝트명"),
          description: text(slide.project.description, 250, "프로젝트 설명"),
        };
        if (slide.project.url) project.url = url(slide.project.url);
        if (slide.project.portfolioId !== undefined) {
          check(
            ["dswar", "shini", "c9pro"].includes(slide.project.portfolioId),
            "기존 포트폴리오를 확인해 주세요.",
          );
          project.portfolioId = slide.project.portfolioId;
        }
        const result = { label: text(slide.label, 150, "화면 이름"), project };
        if (slide.media !== undefined) {
          check(
            record(slide.media) &&
              ["image", "video"].includes(slide.media.type),
            "미디어 종류를 확인해 주세요.",
          );
          result.media = {
            type: slide.media.type,
            src: url(slide.media.src, true),
            alt: text(slide.media.alt, 300, "대체 설명"),
          };
          if (slide.media.poster) {
            check(
              slide.media.type === "video",
              "영상에만 썸네일을 지정할 수 있습니다.",
            );
            result.media.poster = url(slide.media.poster, true);
          }
        }
        return result;
      }),
    };
  });
  const content = { categories };
  check(
    Buffer.byteLength(JSON.stringify(content), "utf8") <= 58000,
    "홈페이지 설정이 너무 큽니다. 문구나 카테고리를 줄여 주세요.",
  );
  return content;
}

export function matchesMediaType(bytes, mime) {
  if (mime === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/gif")
    return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
  if (mime === "image/webp")
    return (
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP"
    );
  if (mime === "video/mp4")
    return (
      bytes.length >= 12 &&
      bytes.toString("ascii", 4, 8) === "ftyp" &&
      bytes.toString("ascii", 8, 12) !== "qt  "
    );
  if (mime === "video/webm")
    return (
      bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) &&
      bytes.includes(Buffer.from("webm"))
    );
  return false;
}
const s3 = new S3Client({
  region: "ap-northeast-2",
  requestChecksumCalculation: "WHEN_REQUIRED",
});
export async function uploadHomepageFile(file) {
  const objectKey = `projects/homepage/${randomUUID()}.${formats[file.mimetype]}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: "ceetool-image",
      Key: objectKey,
      Body: createReadStream(file.path),
      ContentLength: file.size,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { abortSignal: AbortSignal.timeout(120000) },
  );
  return `${MEDIA_BASE}/${objectKey}`;
}

export function mountHomepage(
  app,
  { db, admin, csrf, sameOrigin, logger, uploadMedia = uploadHomepageFile },
) {
  const read = async () => {
    const row = await db.get(
      "SELECT value FROM settings WHERE setting_key = ?",
      key,
    );
    return row ? JSON.parse(row.value) : { revision: null, content: null };
  };
  app.get(`${API_PATH}/homepage`, async (req, res) => {
    const saved = await read();
    res.json({
      ...saved,
      content: saved.content
        ? {
            categories: saved.content.categories.filter(
              (category) => category.visible,
            ),
          }
        : null,
    });
  });
  app.get(`${API_PATH}/admin/homepage`, admin, async (req, res) =>
    res.json(await read()),
  );
  app.put(
    `${API_PATH}/admin/homepage`,
    sameOrigin,
    admin,
    csrf,
    async (req, res) => {
      check(
        record(req.body) &&
          (req.body.revision === null || typeof req.body.revision === "string"),
        "저장 버전을 확인해 주세요.",
      );
      const content = validateContent(req.body.content);
      const saved = await db.transaction(async () => {
        await db.run(
          "INSERT IGNORE INTO settings (setting_key, value) VALUES (?, ?)",
          key,
          JSON.stringify({ revision: null, content: null }),
        );
        const current = JSON.parse(
          (
            await db.get(
              "SELECT value FROM settings WHERE setting_key = ? FOR UPDATE",
              key,
            )
          ).value,
        );
        if (current.revision !== req.body.revision)
          throw new HomepageError(
            409,
            "다른 창에서 설정이 변경되었습니다. 새로 불러온 뒤 다시 수정해 주세요.",
          );
        const next = { revision: randomUUID(), content };
        await db.run(
          "UPDATE settings SET value = ? WHERE setting_key = ?",
          JSON.stringify(next),
          key,
        );
        return next;
      });
      res.json(saved);
    },
  );
  const upload = multer({
    dest: tmpdir(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 0, parts: 1 },
    fileFilter(req, file, done) {
      done(
        formats[file.mimetype]
          ? null
          : new HomepageError(
              400,
              "JPG·PNG·WebP·GIF 이미지 또는 MP4·WebM 영상만 업로드할 수 있습니다.",
            ),
        Boolean(formats[file.mimetype]),
      );
    },
  }).single("file");
  app.post(
    `${API_PATH}/admin/homepage/media`,
    sameOrigin,
    admin,
    csrf,
    rateLimit({
      windowMs: 60000,
      limit: 6,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "업로드 요청이 많습니다. 잠시 후 다시 시도해 주세요." },
    }),
    (req, res, next) =>
      upload(req, res, (error) => {
        if (error instanceof multer.MulterError)
          return next(
            new HomepageError(
              error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
              error.code === "LIMIT_FILE_SIZE"
                ? "파일은 100MB 이하로 업로드해 주세요."
                : "파일 하나만 선택해 주세요.",
            ),
          );
        next(error);
      }),
    async (req, res) => {
      check(req.file, "업로드할 파일을 선택해 주세요.");
      let src;
      try {
        check(req.file.size > 0, "빈 파일은 업로드할 수 없습니다.");
        const handle = await open(req.file.path, "r");
        const bytes = Buffer.alloc(512);
        let bytesRead;
        try {
          ({ bytesRead } = await handle.read(bytes, 0, bytes.length, 0));
        } finally {
          await handle.close();
        }
        check(
          matchesMediaType(bytes.subarray(0, bytesRead), req.file.mimetype),
          "파일 내용과 형식이 일치하지 않습니다.",
        );
        try {
          src = await uploadMedia(req.file);
        } catch (error) {
          logger.error(
            JSON.stringify({
              event: "homepage_upload_failed",
              reason: error.name,
            }),
          );
          throw new HomepageError(
            503,
            "S3 업로드에 실패했습니다. 업로드 권한·네트워크를 확인한 뒤 다시 시도해 주세요.",
          );
        }
      } finally {
        await unlink(req.file.path);
      }
      res.status(201).json({
        media: {
          type: req.file.mimetype.startsWith("video/") ? "video" : "image",
          src,
          alt: "업로드한 미디어",
        },
      });
    },
  );
}

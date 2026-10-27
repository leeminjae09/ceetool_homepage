import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { createTestDatabase, sqlStatements } from "./mysql-helper.mjs";
import { readHomepage, saveHomepage } from "../src/homepage-store.mjs";
import { validateContent } from "../src/homepage.mjs";

const migrationUrl = new URL(
  "../../migrations/20261027_001_relational_homepage.sql",
  import.meta.url,
);
async function migrate(db) {
  const connection = await mysql.createConnection(db.config);
  try {
    const sql = (await readFile(migrationUrl, "utf8")).replaceAll(
      "`ceetool_payments`",
      `\`${db.config.database}\``,
    );
    for (const statement of sqlStatements(sql))
      await connection.query(statement);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}
async function legacyDatabase(t, saved) {
  const db = await createTestDatabase(t);
  for (const table of [
    "homepage_document_projects",
    "homepage_slides",
    "homepage_features",
    "homepage_media",
    "homepage_documents",
    "homepage_categories",
    "homepage_projects",
  ])
    await db.run(`DROP TABLE ${table}`);
  await db.run(
    "DELETE FROM settings WHERE setting_key IN ('homepage_schema', 'homepage_revision')",
  );
  if (saved)
    await db.run(
      "INSERT INTO settings (setting_key, value) VALUES ('homepage_v1', ?)",
      JSON.stringify(saved),
    );
  return db;
}
test("fresh schema contains all 6 categories, 28 projects, 12 media and 6 legacy pages, without forcing carousel images", async (t) => {
  const db = await createTestDatabase(t);
  const saved = await readHomepage(db);
  assert.deepEqual(validateContent(saved.content), saved.content);
  assert.equal(saved.content.categories.length, 6);
  assert.equal(saved.content.projects.length, 28);
  assert.equal(
    saved.content.projects.flatMap((project) => project.media).length,
    12,
  );
  assert.equal(
    saved.content.projects.filter((project) => project.archive).length,
    19,
  );
  assert.equal(saved.content.documents.length, 6);
  assert.equal(
    saved.content.documents.flatMap((document) => document.projectIds).length,
    24,
  );
  assert.ok(
    saved.content.categories.every(
      (category) =>
        category.slides.length === 2 &&
        category.slides.every((slide) => !slide.mediaId),
    ),
  );
  const c9 = saved.content.projects.find((project) => project.id === "c9pro");
  assert.equal(
    c9.media[0].src,
    "https://d2fgd6q9oovwa9.cloudfront.net/projects/c9pro/c9pro-ex1.mp4",
  );
  assert.equal(
    c9.media[0].poster,
    "https://d2fgd6q9oovwa9.cloudfront.net/projects/c9pro/c9pro-ex5.png",
  );
  const updated = structuredClone(saved.content);
  updated.categories[0].title = "관리자 수정";
  updated.projects[0].media[0].alt = "수정된 미디어 설명";
  const changed = await saveHomepage(db, updated, saved.revision);
  await migrate(db);
  assert.deepEqual(await readHomepage(db), changed);
});
test("incremental migration installs on original payment schema and leaves payment settings untouched", async (t) => {
  const db = await legacyDatabase(t);
  await db.run(
    "INSERT INTO settings (setting_key, value) VALUES ('default_terms', '유지할 환불 조건')",
  );
  await migrate(db);
  assert.equal((await readHomepage(db)).content.categories.length, 6);
  assert.equal(
    (
      await db.get(
        "SELECT value FROM settings WHERE setting_key = 'default_terms'",
      )
    ).value,
    "유지할 환불 조건",
  );
  assert.equal(
    (
      await db.get(
        "SELECT value FROM settings WHERE setting_key = 'schema_version'",
      )
    ).value,
    "mysql-v1",
  );
  assert.equal(
    (
      await db.get(
        "SELECT COUNT(*) AS count FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = 'payment_status_email'",
        db.config.database,
      )
    ).count,
    1,
  );
});
test("legacy JSON administrator edits, hidden categories, uploaded media and galleries survive relational migration", async (t) => {
  const old = {
    revision: "existing-admin-revision",
    content: {
      categories: [
        {
          id: "custom-category",
          title: "관리자가 수정한 분야",
          tagline: "기존 소개",
          icon: "payment",
          visible: false,
          featured: true,
          features: ["기존 기능"],
          slides: [
            {
              label: "기존 첫 화면",
              project: {
                name: "수정한 C9Pro",
                description: "기존 관리자 설명",
                portfolioId: "c9pro",
                url: "https://c9-pro.com/",
              },
              media: {
                type: "video",
                src: "https://d2fgd6q9oovwa9.cloudfront.net/projects/homepage/existing.mp4",
                alt: "기존 영상",
                poster:
                  "https://d2fgd6q9oovwa9.cloudfront.net/projects/homepage/existing.png",
              },
            },
            {
              label: "기존 두 번째",
              project: {
                name: "ForYouPay",
                description: "우커머스 통합결제 플러그인",
              },
            },
          ],
        },
      ],
    },
  };
  const db = await legacyDatabase(t, old);
  await migrate(db);
  const saved = await readHomepage(db);
  assert.equal(saved.revision, old.revision);
  assert.equal(saved.content.categories.length, 1);
  const category = saved.content.categories[0];
  assert.equal(category.title, old.content.categories[0].title);
  assert.equal(category.visible, false);
  assert.deepEqual(category.features, ["기존 기능"]);
  const project = saved.content.projects.find(
    (project) => project.id === category.slides[0].projectId,
  );
  assert.equal(project.name, "수정한 C9Pro");
  assert.equal(project.media.length, 5);
  assert.deepEqual(
    project.media.find((media) => media.id === category.slides[0].mediaId),
    {
      id: category.slides[0].mediaId,
      ...old.content.categories[0].slides[0].media,
    },
  );
  assert.equal(saved.content.documents.length, 6);
  assert.equal(
    (
      await db.get(
        "SELECT value FROM settings WHERE setting_key = 'homepage_v1'",
      )
    ).value,
    JSON.stringify(old),
  );
  await migrate(db);
  assert.deepEqual(await readHomepage(db), saved);
});
test("an intentionally empty legacy homepage stays empty instead of restoring default categories", async (t) => {
  const db = await legacyDatabase(t, {
    revision: "empty",
    content: { categories: [] },
  });
  await migrate(db);
  const saved = await readHomepage(db);
  assert.deepEqual(saved.content.categories, []);
  assert.equal(saved.content.projects.length, 28);
});
test("relational content writes roll back completely on a foreign-key failure", async (t) => {
  const db = await createTestDatabase(t);
  const saved = await readHomepage(db);
  const invalid = structuredClone(saved.content);
  invalid.categories[0].slides[0].projectId = "missing-project";
  await assert.rejects(saveHomepage(db, invalid, saved.revision), {
    code: "ER_NO_REFERENCED_ROW_2",
  });
  assert.deepEqual(await readHomepage(db), saved);
});
test("full-install homepage SQL and incremental migration contain the same DDL and seed", async () => {
  const full = await readFile(
    new URL("../../tables.sql", import.meta.url),
    "utf8",
  );
  const migration = await readFile(migrationUrl, "utf8");
  assert.equal(
    full.slice(full.indexOf("CREATE TABLE IF NOT EXISTS homepage_categories")),
    migration.slice(
      migration.indexOf("CREATE TABLE IF NOT EXISTS homepage_categories"),
    ),
  );
});

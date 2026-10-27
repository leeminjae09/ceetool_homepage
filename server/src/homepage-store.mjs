import { randomUUID } from "node:crypto";

async function snapshot(db) {
  const [categories, features, slides, projects, media, documents, links] =
    await Promise.all([
      db.all("SELECT * FROM homepage_categories ORDER BY sort_order, id"),
      db.all("SELECT * FROM homepage_features ORDER BY category_id, position"),
      db.all("SELECT * FROM homepage_slides ORDER BY category_id, position"),
      db.all("SELECT * FROM homepage_projects ORDER BY sort_order, id"),
      db.all("SELECT * FROM homepage_media ORDER BY project_id, position"),
      db.all("SELECT * FROM homepage_documents ORDER BY sort_order, id"),
      db.all(
        "SELECT * FROM homepage_document_projects ORDER BY document_id, position",
      ),
    ]);
  return {
    categories: categories.map((category) => ({
      id: category.id,
      title: category.title,
      tagline: category.tagline,
      description: category.description,
      icon: category.icon,
      visible: Boolean(category.visible),
      featured: Boolean(category.featured),
      features: features
        .filter((feature) => feature.category_id === category.id)
        .map((feature) => feature.text),
      slides: slides
        .filter((slide) => slide.category_id === category.id)
        .map((slide) => ({
          label: slide.label,
          projectId: slide.project_id,
          ...(slide.media_id ? { mediaId: slide.media_id } : {}),
        })),
    })),
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      details: project.details,
      ...(project.url ? { url: project.url } : {}),
      archive: Boolean(project.archived),
      media: media
        .filter((item) => item.project_id === project.id)
        .map((item) => ({
          id: item.id,
          type: item.type,
          src: item.src,
          alt: item.alt,
          ...(item.poster ? { poster: item.poster } : {}),
        })),
    })),
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      description: document.description,
      details: document.details,
      projectIds: links
        .filter((link) => link.document_id === document.id)
        .map((link) => link.project_id),
    })),
  };
}
export async function readHomepage(db) {
  return db.transaction(async () => {
    const revision = await db.get(
      "SELECT value FROM settings WHERE setting_key = 'homepage_revision' FOR SHARE",
    );
    if (!revision)
      throw new Error(
        "Apply migrations/20261027_001_relational_homepage.sql before using homepage content",
      );
    return { revision: revision.value, content: await snapshot(db) };
  });
}
export async function saveHomepage(db, content, expectedRevision) {
  return db.transaction(async () => {
    const current = await db.get(
      "SELECT value FROM settings WHERE setting_key = 'homepage_revision' FOR UPDATE",
    );
    if (!current)
      throw new Error("Homepage relational schema has not been installed");
    if (current.value !== expectedRevision) return null;
    for (const table of [
      "homepage_document_projects",
      "homepage_slides",
      "homepage_features",
      "homepage_media",
      "homepage_documents",
      "homepage_categories",
      "homepage_projects",
    ])
      await db.run(`DELETE FROM ${table}`);
    for (const [order, project] of content.projects.entries()) {
      await db.run(
        "INSERT INTO homepage_projects (id, name, description, details, url, archived, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        project.id,
        project.name,
        project.description,
        project.details,
        project.url ?? null,
        project.archive,
        order,
      );
      for (const [position, media] of project.media.entries())
        await db.run(
          "INSERT INTO homepage_media (id, project_id, position, type, src, alt, poster) VALUES (?, ?, ?, ?, ?, ?, ?)",
          media.id,
          project.id,
          position + 1,
          media.type,
          media.src,
          media.alt,
          media.poster ?? null,
        );
    }
    for (const [order, category] of content.categories.entries()) {
      await db.run(
        "INSERT INTO homepage_categories (id, title, tagline, description, icon, visible, featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        category.id,
        category.title,
        category.tagline,
        category.description,
        category.icon,
        category.visible,
        category.featured,
        order,
      );
      for (const [position, feature] of category.features.entries())
        await db.run(
          "INSERT INTO homepage_features (category_id, position, text) VALUES (?, ?, ?)",
          category.id,
          position + 1,
          feature,
        );
      for (const [position, slide] of category.slides.entries())
        await db.run(
          "INSERT INTO homepage_slides (category_id, position, label, project_id, media_id) VALUES (?, ?, ?, ?, ?)",
          category.id,
          position + 1,
          slide.label,
          slide.projectId,
          slide.mediaId ?? null,
        );
    }
    for (const [order, document] of content.documents.entries()) {
      await db.run(
        "INSERT INTO homepage_documents (id, title, description, details, sort_order) VALUES (?, ?, ?, ?, ?)",
        document.id,
        document.title,
        document.description,
        document.details,
        order,
      );
      for (const [position, id] of document.projectIds.entries())
        await db.run(
          "INSERT INTO homepage_document_projects (document_id, project_id, position) VALUES (?, ?, ?)",
          document.id,
          id,
          position + 1,
        );
    }
    const revision = randomUUID();
    await db.run(
      "UPDATE settings SET value = ? WHERE setting_key = 'homepage_revision'",
      revision,
    );
    return { revision, content };
  });
}

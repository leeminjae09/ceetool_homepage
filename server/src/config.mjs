export const PAYSM_BASE_URL = "https://api.skyclassism.com";
export const PUBLIC_SITE_URL = "https://ceetool.com";
export const API_PATH = "/api/payments";
export const GOOGLE_CALLBACK = `${PUBLIC_SITE_URL}${API_PATH}/admin/callback`;

export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3888);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  const config = {
    production: env.NODE_ENV === "production",
    port,
    database: {
      host: env.DB_HOST || "localhost",
      port: Number(env.DB_PORT || 3306),
      user: env.DB_USER || "ceetool_user",
      password: env.DB_PASS || "",
      database: env.DB_NAME || "ceetool_payments",
    },
    mid: env.PAYSM_MID || "",
    merchantKey: env.PAYSM_MERCHANT_KEY || "",
    googleClientId: env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: env.GOOGLE_CLIENT_SECRET || "",
    adminEmails: (env.ADMIN_GOOGLE_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  };
  if (
    !Number.isInteger(config.database.port) ||
    config.database.port < 1 ||
    config.database.port > 65535
  )
    throw new Error("DB_PORT must be an integer between 1 and 65535");
  if (!/^[A-Za-z0-9_]{1,64}$/.test(config.database.database))
    throw new Error(
      "DB_NAME must contain only letters, digits and underscores",
    );
  if (config.mid && !/^[A-Za-z0-9_-]{10}$/.test(config.mid)) {
    throw new Error("PAYSM_MID must be the issued 10-character MID");
  }
  return config;
}

export const paymentReady = (config) =>
  Boolean(config.mid && config.merchantKey);
export const googleReady = (config) =>
  Boolean(
    config.googleClientId &&
      config.googleClientSecret &&
      config.adminEmails.length,
  );

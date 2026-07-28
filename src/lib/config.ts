export function getAppUrl(): string {
  const url = process.env.APP_URL || "http://localhost:3000";
  return url.replace(/\/$/, ""); // Normalize trailing slash
}

export function getConfig() {
  const isGmassConfigured =
    !!process.env.GMASS_API_KEY &&
    !!process.env.GMASS_FROM_EMAIL &&
    !!process.env.GMASS_FROM_NAME;

  const isAiConfigured =
    !!process.env.OPENAI_API_KEY || !!process.env.GEMINI_API_KEY;

  const aiProvider = process.env.OPENAI_API_KEY
    ? "openai"
    : process.env.GEMINI_API_KEY
    ? "gemini"
    : null;

  return {
    database: {
      configured: !!process.env.DATABASE_URL || !!process.env.SUPABASE_URL,
    },
    app: {
      url: getAppUrl(),
      nextAuthSecretConfigured: !!process.env.NEXTAUTH_SECRET,
    },
    gmass: {
      configured: isGmassConfigured,
      senderConfigured: !!process.env.GMASS_FROM_EMAIL,
    },
    ai: {
      configured: isAiConfigured,
      provider: aiProvider,
    },
    reporting: {
      configured: !!process.env.REPORT_LINK_SECRET,
    },
    webhooks: {
      configured: !!process.env.WEBHOOK_SECRET,
    },
  };
}

export function validateCriticalConfig() {
  const config = getConfig();

  if (!config.database.configured) {
    console.warn("⚠️ DATABASE_URL or SUPABASE_URL is missing. Application may fail.");
  }
  if (!config.app.nextAuthSecretConfigured) {
    console.warn("⚠️ NEXTAUTH_SECRET is missing.");
  }
}

// Call validate on module load
validateCriticalConfig();

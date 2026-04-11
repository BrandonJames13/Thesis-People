/**
 * lib/supabaseEnv.js
 * Shared Supabase environment validation helpers.
 */

function getTrimmedEnvValue(name) {
  return String(import.meta.env[name] ?? "").trim();
}

export function requireSupabaseEnvVars(names, scopeLabel = "Supabase") {
  const missing = names.filter((name) => !getTrimmedEnvValue(name));

  if (missing.length > 0) {
    throw new Error(
      `Missing ${scopeLabel} environment variables: ${missing.join(", ")}`,
    );
  }
}

export function getRequiredSupabaseEnv(name) {
  const value = getTrimmedEnvValue(name);
  if (!value) {
    throw new Error(`Missing Supabase environment variable: ${name}`);
  }
  return value;
}

export function validateSupabaseUrl(url) {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("VITE_SUPABASE_URL must be a valid http(s) URL");
  }
}

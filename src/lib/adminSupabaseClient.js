/**
 * lib/adminSupabaseClient.js
 * Helper to initialize the Supabase admin client.
 */

import { createClient } from "@supabase/supabase-js";
import {
  getRequiredSupabaseEnv,
  requireSupabaseEnvVars,
  validateSupabaseUrl,
} from "./supabaseEnv";

const REQUIRED_ADMIN_ENV_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_SERVICE_ROLE_KEY",
];

requireSupabaseEnvVars(REQUIRED_ADMIN_ENV_VARS, "Supabase admin");

const supabaseUrl = getRequiredSupabaseEnv("VITE_SUPABASE_URL");
const supabaseServiceRoleKey = getRequiredSupabaseEnv(
  "VITE_SUPABASE_SERVICE_ROLE_KEY",
);

validateSupabaseUrl(supabaseUrl);

export const adminSupabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * lib/supabaseClient.js
 * Helper to initialize the Supabase client.
 */

import { createClient } from "@supabase/supabase-js";
import {
  getRequiredSupabaseEnv,
  requireSupabaseEnvVars,
  validateSupabaseUrl,
} from "./supabaseEnv";

const REQUIRED_ENV_VARS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

requireSupabaseEnvVars(REQUIRED_ENV_VARS, "Supabase");

const supabaseUrl = getRequiredSupabaseEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = getRequiredSupabaseEnv("VITE_SUPABASE_ANON_KEY");

validateSupabaseUrl(supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

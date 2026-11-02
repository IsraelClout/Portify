const SUPABASE_URL = "https://imawsdraogyszlhxtqxh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aXTRJ3EtMN0fNS3n_dlp3g_e_SwWyq4";

window.supabaseClient = null;

if (window.supabase && window.supabase.createClient) {
  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
}
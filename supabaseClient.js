const SUPABASE_URL = "https://yidinujmeuztqohwxfxs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LVvQQpJHxeif-zmJjIJy8w_jDV_MXX4";

const supabaseClient = window.supabase
  ? supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    )
  : null;

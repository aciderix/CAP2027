import { createClient } from '@supabase/supabase-js';

const url =
  import.meta.env.VITE_SUPABASE_URL ??
  'https://oyvqvfawcxlnvpgloicx.supabase.co';
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_nycw__S1NdZYIVyu4LH4SQ_830IdXPA';

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.warn('Supabase URL/key missing. Admin will not work.');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});

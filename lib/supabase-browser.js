import { createClient } from '@supabase/supabase-js';

// Client réservé au navigateur. Il utilise uniquement la clé publishable,
// jamais la clé secrète utilisée dans les routes API.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
);

import { assertSupabaseConfigured } from '../../../lib/supabase';
import { jsonError, requireUser } from '../../../lib/require-user';

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = assertSupabaseConfigured();
    if (req.method === 'GET') {
      const { data: contacts, error: contactsError } = await supabase.from('member_contacts').select('member_id').eq('owner_id', user.id);
      if (contactsError) throw contactsError;
      const authors = [user.id, ...(contacts || []).map((row) => row.member_id)];
      const { data: blocked } = await supabase.from('member_blocks').select('blocked_id').eq('blocker_id', user.id);
      const blockedIds = new Set((blocked || []).map((row) => row.blocked_id));
      const { data, error } = await supabase.from('member_stories').select('*').in('author_id', authors).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json((data || []).filter((story) => !blockedIds.has(story.author_id)));
    }
    if (req.method === 'POST') {
      const { mediaUrl, mediaType = 'image', caption = '' } = req.body || {};
      if (!mediaUrl || !['image', 'video'].includes(mediaType)) throw new Error('Story invalide');
      const { data, error } = await supabase.from('member_stories').insert({ author_id: user.id, media_url: mediaUrl, media_type: mediaType, caption: String(caption).slice(0, 500) }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    res.setHeader('Allow', 'GET, POST'); return res.status(405).end();
  } catch (error) { return jsonError(res, error); }
}

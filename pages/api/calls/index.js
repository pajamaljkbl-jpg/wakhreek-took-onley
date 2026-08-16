import { supabaseAdmin } from '../../../lib/supabase';
import { requireUser, jsonError } from '../../../lib/require-user';

const MEMBER_CALL_TABLE = 'member_call_sessions';
const SHOP_CALL_TABLE = 'call_sessions';

async function resolveConversation(conversationId, user) {
  const { data: member, error: memberError } = await supabaseAdmin
    .from('member_conversations')
    .select('id, member_one_id, member_two_id')
   
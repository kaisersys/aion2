import type {SupabaseClient,User} from '@supabase/supabase-js';
import type {PlayerProfile} from './playerData';

/**
 * Resolve first-login profile creation safely even if React StrictMode,
 * another tab, or another device requests the same profile concurrently.
 *
 * "ignoreDuplicates: true" maps to INSERT ... ON CONFLICT DO NOTHING, so an
 * existing display name, class, or faction is NEVER overwritten by login.
 * Requires only the existing user-owned INSERT and SELECT RLS policies.
 */
export async function ensurePlayerProfile(
  client: SupabaseClient,
  user: Pick<User,'id'|'email'|'user_metadata'>,
  existing: PlayerProfile|null
):Promise<PlayerProfile> {
  if(existing)return existing;

  const rawName=String(user.user_metadata?.display_name||user.email?.split('@')[0]||'Daeva');
  const safeName=rawName.trim().slice(0,40)||'Daeva';

  const {error:insertError}=await client.from('player_profiles')
    .upsert({user_id:user.id,display_name:safeName},{
      onConflict:'user_id',
      ignoreDuplicates:true
    });
  if(insertError)throw insertError;

  // Both concurrent callers read the same winning row after the database
  // has resolved the unique-key conflict.
  const {data,error:readError}=await client.from('player_profiles')
    .select('user_id,display_name,class_name,faction')
    .eq('user_id',user.id)
    .single();
  if(readError)throw readError;
  if(!data)throw new Error('Your profile could not be loaded. Please try again.');
  return data as PlayerProfile;
}

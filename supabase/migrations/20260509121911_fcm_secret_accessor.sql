-- Security-definer accessor so the push-broadcast edge function can
-- pull the FCM service account out of Vault without giving any client
-- direct access to vault.decrypted_secrets.
create or replace function public.get_fcm_service_account()
returns text
language sql
security definer
set search_path = vault, public
as $$
  select decrypted_secret::text
  from vault.decrypted_secrets
  where name = 'fcm_service_account'
  limit 1;
$$;

revoke execute on function public.get_fcm_service_account() from public;
revoke execute on function public.get_fcm_service_account() from anon, authenticated;
-- service_role implicitly has access; that's the role the edge function uses.

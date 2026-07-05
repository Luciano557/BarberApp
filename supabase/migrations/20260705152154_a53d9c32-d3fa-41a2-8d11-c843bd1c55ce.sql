revoke all on public.push_tokens from anon;

revoke all on public.push_tokens from authenticated;

revoke all on public.push_tokens from service_role;

grant select, insert, update on public.push_tokens to authenticated;

grant all on public.push_tokens to service_role;
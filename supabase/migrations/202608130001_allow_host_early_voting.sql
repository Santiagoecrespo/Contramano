-- Corrective migration: let the host open voting before the debate timer ends.
-- Safe for existing projects: it only replaces one RPC and preserves RLS and data.
create or replace function public.advance_to_voting(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r rooms; current rounds;
begin
  select * into r from public.assert_live_room(rid);
  if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host abre la votación'; end if;
  select * into current from rounds where room_id=rid order by number desc limit 1 for update;
  if current.phase in ('voting','results') then return public.get_room_snapshot(p_room_id); end if;
  if current.phase<>'debating' then raise exception 'La ronda no está debatiendo'; end if;
  update rounds set phase='voting',vote_ends_at=now()+interval '30 seconds' where id=current.id;
  insert into events(room_id,name) values(rid,'voting_opened');
  perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

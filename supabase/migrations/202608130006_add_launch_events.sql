-- Hito 5: minimal launch metrics for existing Contramano projects.
-- Safe after 202608130005_fix_join_room_grant.sql. It preserves all data,
-- keeps RLS intact and only replaces RPCs to record aggregate game events.

create or replace function public.start_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; pid uuid;
begin
  select * into r from public.assert_live_room(rid);
  select public.viewer_player(rid) into pid;
  if r.host_player_id<>pid then raise exception 'Sólo el host puede empezar'; end if;
  if r.phase<>'lobby' then raise exception 'La partida ya empezó'; end if;
  if (select count(*) from public.players where room_id=rid) not between 3 and 8 then raise exception 'Se necesitan entre tres y ocho jugadores'; end if;
  perform public.start_new_round(rid);
  insert into public.events(room_id,player_id,name,metadata)
    values(rid,pid,'game_started',jsonb_build_object('player_count',(select count(*) from public.players where room_id=rid),'intensity',r.intensity));
  perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.start_round(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current_phase text; pid uuid;
begin
  select * into r from public.assert_live_room(rid);
  select public.viewer_player(rid) into pid;
  if r.host_player_id<>pid then raise exception 'Sólo el host puede continuar'; end if;
  if r.phase<>'playing' then raise exception 'La partida no está activa'; end if;
  select phase into current_phase from public.rounds where room_id=rid order by number desc limit 1;
  if current_phase is distinct from 'results' then raise exception 'Primero terminá la ronda actual'; end if;
  if r.round_count>=5 then
    update public.rooms set phase='finished' where id=rid;
    insert into public.events(room_id,player_id,name) values(rid,pid,'game_finished');
    perform public.notify_room(rid);
    return public.get_room_snapshot(p_room_id);
  end if;
  perform public.start_new_round(rid);
  perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.track_event(p_room_id text,p_name text) returns void language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); pid uuid;
begin
  perform public.assert_live_room(rid);
  if p_name<>'whatsapp_share_clicked' then raise exception 'Evento no permitido'; end if;
  select public.viewer_player(rid) into pid;
  insert into public.events(room_id,player_id,name) values(rid,pid,p_name);
end $$;

create or replace function public.confirm_prompt_change(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current_round public.rounds; next_prompt text; skipped_prompt text;
begin
  select * into r from public.assert_live_room(rid);
  if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host confirma el cambio'; end if;
  select * into current_round from public.rounds where room_id=rid order by number desc limit 1 for update;
  if current_round.phase<>'debating' then raise exception 'No hay un debate activo'; end if;
  if not exists(select 1 from public.prompt_change_requests where round_id=current_round.id) then raise exception 'No hay solicitud pendiente'; end if;
  skipped_prompt:=current_round.prompt_id;
  next_prompt:=public.deal_prompt(rid,r.intensity);
  update public.rounds set prompt_id=next_prompt,ends_at=now()+interval '60 seconds' where id=current_round.id;
  delete from public.prompt_change_requests where round_id=current_round.id;
  insert into public.events(room_id,name,metadata) values(rid,'prompt_skipped',jsonb_build_object('prompt_id',skipped_prompt));
  perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

grant execute on function public.start_game(text),public.start_round(text),public.track_event(text,text) to authenticated;

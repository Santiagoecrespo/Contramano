-- Hito 4: server-authoritative resilience for existing Contramano projects.
-- Safe to run after 202608130003_tighten_prompt_conflicts.sql. It preserves rooms,
-- rounds, votes and RLS; it only adds recovery metadata and replaces RPCs.

alter table public.rooms add column if not exists paused_at timestamptz;
alter table public.rooms add column if not exists paused_phase text check (paused_phase in ('debating','voting'));
alter table public.rooms add column if not exists pause_reason text check (pause_reason in ('low_players','host'));
alter table public.rooms add column if not exists successor_room_id uuid references public.rooms(id);
alter table public.players add column if not exists last_seen_at timestamptz not null default now();
update public.players set last_seen_at=coalesce(last_seen_at, joined_at, now()) where last_seen_at is null;
create index if not exists players_room_last_seen_idx on public.players(room_id,last_seen_at desc);

create or replace function public.assert_live_room(p_room uuid) returns public.rooms language plpgsql security definer set search_path=public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where id=p_room for update;
  if not found then raise exception 'Sala no encontrada'; end if;
  if r.expires_at<=now() then raise exception 'Sala vencida'; end if;
  if r.phase='cancelled' then raise exception 'Sala cancelada'; end if;
  if not exists(select 1 from public.players where room_id=p_room and auth_user_id=auth.uid()) then raise exception 'No pertenecés a esta sala'; end if;
  return r;
end $$;

create or replace function public.connected_player_count(p_room uuid) returns integer language sql stable security definer set search_path=public as $$
  select count(*)::integer from public.players where room_id=p_room and last_seen_at>=now()-interval '20 seconds'
$$;

create or replace function public.pause_active_room(p_room uuid,p_reason text) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.rooms; current public.rounds;
begin
  select * into r from public.rooms where id=p_room for update;
  if r.phase<>'playing' then return false; end if;
  select * into current from public.rounds where room_id=p_room order by number desc limit 1 for update;
  if current.phase not in ('debating','voting') then return false; end if;
  update public.rooms set phase='paused',paused_at=now(),paused_phase=current.phase,pause_reason=p_reason where id=p_room;
  insert into public.events(room_id,name,metadata) values(p_room,'game_paused',jsonb_build_object('reason',p_reason));
  return true;
end $$;

create or replace function public.transfer_absent_host(p_room uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.rooms; next_host uuid; host_seen timestamptz;
begin
  select * into r from public.rooms where id=p_room for update;
  select last_seen_at into host_seen from public.players where id=r.host_player_id;
  if host_seen is not null and host_seen>=now()-interval '45 seconds' then return false; end if;
  if public.connected_player_count(p_room)<3 then return false; end if;
  select id into next_host from public.players
    where room_id=p_room and id<>r.host_player_id and last_seen_at>=now()-interval '20 seconds'
    order by joined_at,id limit 1;
  if next_host is null then return false; end if;
  update public.players set is_host=(id=next_host) where room_id=p_room;
  update public.rooms set host_player_id=next_host where id=p_room;
  insert into public.events(room_id,player_id,name,metadata) values(p_room,next_host,'host_transferred',jsonb_build_object('previous_host',r.host_player_id,'new_host',next_host));
  return true;
end $$;

create or replace function public.reconcile_room(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current public.rounds; changed boolean:=false;
begin
  select * into r from public.assert_live_room(rid);
  if r.phase in ('playing','paused') and public.connected_player_count(rid)<3 then
    changed:=public.pause_active_room(rid,'low_players') or changed;
  end if;
  changed:=public.transfer_absent_host(rid) or changed;
  select * into r from public.rooms where id=rid for update;
  if r.phase='playing' then
    select * into current from public.rounds where room_id=rid order by number desc limit 1 for update;
    if current.phase='debating' and now()>=current.ends_at then
      update public.rounds set phase='voting',vote_ends_at=now()+interval '30 seconds' where id=current.id;
      insert into public.events(room_id,name) values(rid,'voting_opened'); changed:=true;
    elsif current.phase='voting' and now()>=current.vote_ends_at then
      perform public.finalize_round(current.id); changed:=true;
    end if;
  end if;
  if changed then perform public.notify_room(rid); end if;
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.heartbeat(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); pid uuid;
begin
  perform public.assert_live_room(rid);
  select public.viewer_player(rid) into pid;
  update public.players set last_seen_at=now() where id=pid;
  return public.reconcile_room(p_room_id);
end $$;

create or replace function public.resume_room_member(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id);
begin
  perform public.assert_live_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.get_room_snapshot(p_code text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_code); r public.rooms; latest public.rounds; viewer uuid; phase_value text; paused_seconds integer;
begin
  select * into r from public.assert_live_room(rid);
  select public.viewer_player(rid) into viewer;
  select * into latest from public.rounds where room_id=rid order by number desc limit 1;
  phase_value:=case
    when r.phase='playing' and latest.id is not null then latest.phase
    when r.phase='paused' then 'paused'
    when r.phase='finished' then 'finished'
    else 'lobby'
  end;
  paused_seconds:=case when r.phase='paused' and latest.id is not null and r.paused_at is not null then greatest(0,ceil(extract(epoch from ((case when r.paused_phase='voting' then latest.vote_ends_at else latest.ends_at end)-r.paused_at)))::integer) else null end;
  return jsonb_build_object(
    'code',r.code,'hostId',r.host_player_id,'intensity',r.intensity,'phase',phase_value,
    'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'isHost',p.is_host,'score',p.score,'activeFromRound',p.active_from_round,'juryRounds',p.jury_rounds) order by p.joined_at) from public.players p where p.room_id=rid),'[]'::jsonb),
    'connectedPlayerIds',coalesce((select jsonb_agg(p.id order by p.joined_at) from public.players p where p.room_id=rid and p.last_seen_at>=now()-interval '20 seconds'),'[]'::jsonb),
    'rounds',coalesce((select jsonb_agg(jsonb_build_object('number',q.number,'promptId',q.prompt_id,'prompt',jsonb_build_object('id',pr.id,'category',pr.category,'intensity',pr.intensity,'status',pr.status,'text',pr.text,'sideA',pr.side_a,'sideB',pr.side_b),'jurorIds',coalesce((select jsonb_agg(rp.player_id) from public.round_players rp where rp.round_id=q.id and rp.role='juror'),'[]'::jsonb),'assignments',coalesce((select jsonb_object_agg(rp.player_id,rp.side) from public.round_players rp where rp.round_id=q.id and rp.role='debater'),'{}'::jsonb),'debateEndsAt',q.ends_at,'voteEndsAt',q.vote_ends_at,'votes',case when q.phase='results' then coalesce((select jsonb_agg(jsonb_build_object('playerId',v.player_id,'side',v.side)) from public.votes v where v.round_id=q.id),'[]'::jsonb) else coalesce((select jsonb_agg(jsonb_build_object('playerId',v.player_id,'side',v.side)) from public.votes v where v.round_id=q.id and v.player_id=viewer),'[]'::jsonb) end,'changeRequests',coalesce((select jsonb_agg(c.player_id) from public.prompt_change_requests c where c.round_id=q.id),'[]'::jsonb),'result',q.result,'wasRandomTiebreak',q.was_random_tiebreak) order by q.number) from public.rounds q join public.prompts pr on pr.id=q.prompt_id where q.room_id=rid),'[]'::jsonb),
    'decks',jsonb_build_object('tranqui',jsonb_build_object('order','[]'::jsonb,'cursor',0,'history','[]'::jsonb,'cycle',1),'bardo',jsonb_build_object('order','[]'::jsonb,'cursor',0,'history','[]'::jsonb,'cycle',1)),
    'lastOddExtraSide',r.last_odd_extra_side,'createdAt',r.created_at,'expiresAt',r.expires_at,'serverNow',now(),'viewerPlayerId',viewer,
    'pausedPhase',r.paused_phase,'pausedRemainingSeconds',paused_seconds,'pauseReason',r.pause_reason,
    'successorCode',(select code from public.rooms where id=r.successor_room_id)
  );
end $$;

create or replace function public.advance_to_voting(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current public.rounds; pid uuid;
begin
  select * into r from public.assert_live_room(rid); select public.viewer_player(rid) into pid;
  select * into current from public.rounds where room_id=rid order by number desc limit 1 for update;
  if current.phase in ('voting','results') then return public.get_room_snapshot(p_room_id); end if;
  if r.phase<>'playing' then raise exception 'La partida está en pausa'; end if;
  if current.phase<>'debating' then raise exception 'La ronda no está debatiendo'; end if;
  if now()<current.ends_at and r.host_player_id<>pid then raise exception 'Sólo el host abre la votación antes de tiempo'; end if;
  update public.rounds set phase='voting',vote_ends_at=now()+interval '30 seconds' where id=current.id;
  insert into public.events(room_id,name) values(rid,'voting_opened'); perform public.notify_room(rid);
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.cast_vote(p_room_id text,p_side text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current public.rounds; pid uuid; inserted integer:=0; changed boolean:=false;
begin
  select * into r from public.assert_live_room(rid); if p_side not in ('A','B') then raise exception 'Postura inválida'; end if;
  if r.phase<>'playing' then raise exception 'La partida está en pausa'; end if;
  select public.viewer_player(rid) into pid; select * into current from public.rounds where room_id=rid order by number desc limit 1 for update;
  if current.phase='results' then return public.get_room_snapshot(p_room_id); end if;
  if current.phase<>'voting' then raise exception 'La votación no está abierta'; end if;
  if now()>=current.vote_ends_at then perform public.finalize_round(current.id); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id); end if;
  if not exists(select 1 from public.round_players where round_id=current.id and player_id=pid and role='juror') then raise exception 'Sólo el jurado puede votar'; end if;
  insert into public.votes(round_id,player_id,side) values(current.id,pid,p_side) on conflict(round_id,player_id) do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 and (select count(*) from public.votes where round_id=current.id)=(select count(*) from public.round_players where round_id=current.id and role='juror') then perform public.finalize_round(current.id); changed:=true; end if;
  if inserted=1 or changed then perform public.notify_room(rid); end if;
  return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.close_voting(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current public.rounds;
begin
  select * into r from public.assert_live_room(rid); select * into current from public.rounds where room_id=rid order by number desc limit 1 for update;
  if current.phase='results' then return public.get_room_snapshot(p_room_id); end if;
  if r.phase<>'playing' then raise exception 'La partida está en pausa'; end if;
  if current.phase<>'voting' then raise exception 'La votación no está abierta'; end if;
  if now()<current.vote_ends_at then raise exception 'Todavía queda tiempo de votación'; end if;
  perform public.finalize_round(current.id); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.pause_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms;
begin
  select * into r from public.assert_live_room(rid);
  if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host puede pausar'; end if;
  perform public.pause_active_room(rid,'host'); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.resume_game(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; current public.rounds; paused_for interval;
begin
  select * into r from public.assert_live_room(rid);
  if r.host_player_id<>public.viewer_player(rid) then raise exception 'Sólo el host puede reanudar'; end if;
  if r.phase<>'paused' then return public.get_room_snapshot(p_room_id); end if;
  if public.connected_player_count(rid)<3 then raise exception 'Todavía faltan jugadores para reanudar'; end if;
  select * into current from public.rounds where room_id=rid order by number desc limit 1 for update;
  paused_for:=now()-coalesce(r.paused_at,now());
  if r.paused_phase='voting' then update public.rounds set vote_ends_at=vote_ends_at+paused_for where id=current.id;
  else update public.rounds set ends_at=ends_at+paused_for where id=current.id; end if;
  update public.rooms set phase='playing',paused_at=null,paused_phase=null,pause_reason=null where id=rid;
  insert into public.events(room_id,name) values(rid,'game_resumed'); perform public.notify_room(rid); return public.get_room_snapshot(p_room_id);
end $$;

create or replace function public.rematch(p_room_id text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_room_id); r public.rooms; pid uuid; new_room uuid; generated text; attempts integer:=0;
begin
  select * into r from public.assert_live_room(rid); select public.viewer_player(rid) into pid;
  if r.host_player_id<>pid then raise exception 'Sólo el host puede pedir revancha'; end if;
  if r.phase<>'finished' then raise exception 'La revancha se habilita al terminar'; end if;
  update public.players set last_seen_at=now() where id=pid;
  loop
    generated:=array_to_string(array(select substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',floor(random()*32)::integer+1,1) from generate_series(1,8)), '');
    begin insert into public.rooms(code,intensity) values(generated,r.intensity) returning id into new_room; exit;
    exception when unique_violation then attempts:=attempts+1; if attempts>=5 then raise exception 'No se pudo generar un código único'; end if;
    end;
  end loop;
  insert into public.players(room_id,auth_user_id,nickname,is_host,score,jury_rounds,active_from_round,last_seen_at)
    select new_room,p.auth_user_id,p.nickname,p.id=pid,0,0,1,now() from public.players p
    where p.room_id=rid and p.last_seen_at>=now()-interval '20 seconds';
  update public.rooms set host_player_id=(select id from public.players where room_id=new_room and auth_user_id=auth.uid()) where id=new_room;
  insert into public.prompt_decks(room_id,intensity,deck)
    select new_room,x,array(select id from public.prompts where intensity=x and status='active' order by random()) from unnest(array['tranqui','bardo']) x;
  update public.rooms set successor_room_id=new_room where id=rid;
  insert into public.events(room_id,player_id,name,metadata) values(rid,pid,'rematch_started',jsonb_build_object('new_room_code',generated));
  perform public.notify_room(rid); return public.get_room_snapshot(generated);
end $$;

create or replace function public.join_room(p_code text,p_nickname text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rid uuid:=public.resolve_room(p_code); r public.rooms; pid uuid;
begin
  if auth.uid() is null then raise exception 'Iniciá una sesión anónima antes de entrar'; end if;
  select * into r from public.rooms where id=rid for update;
  if r.expires_at<=now() then raise exception 'Sala vencida'; end if;
  if r.phase='cancelled' then raise exception 'Sala cancelada'; end if;
  select id into pid from public.players where room_id=rid and auth_user_id=auth.uid();
  if pid is null then
    if r.phase not in ('lobby','playing','paused') then raise exception 'La partida terminó'; end if;
    if (select count(*) from public.players where room_id=rid)>=8 then raise exception 'La sala está completa'; end if;
    if char_length(trim(p_nickname)) not between 2 and 16 then raise exception 'El apodo debe tener entre 2 y 16 caracteres'; end if;
    insert into public.players(room_id,auth_user_id,nickname,active_from_round,last_seen_at) values(rid,auth.uid(),trim(p_nickname),case when r.phase='lobby' then 1 else r.round_count+1 end,now()) returning id into pid;
    insert into public.events(room_id,player_id,name) values(rid,pid,'player_joined'); perform public.notify_room(rid);
  else
    update public.players set last_seen_at=now() where id=pid;
  end if;
  return public.reconcile_room(p_code);
end $$;

grant execute on function public.heartbeat(text),public.reconcile_room(text),public.resume_room_member(text) to authenticated;
grant execute on function public.advance_to_voting(text),public.cast_vote(text,text),public.close_voting(text),public.pause_game(text),public.resume_game(text),public.rematch(text),public.join_room(text),public.get_room_snapshot(text) to authenticated;

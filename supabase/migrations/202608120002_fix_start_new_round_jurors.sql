-- Corrective migration for projects that already ran 202608120001_realtime_multiplayer.sql.
-- Safe to run in Supabase SQL Editor: it only replaces the server function.
create or replace function public.start_new_round(p_room uuid) returns void language plpgsql security definer set search_path=public as $$
declare r rooms; n integer; prompt text; previous_round uuid; new_round uuid; jurors uuid[]; extra text; target_a integer; candidate record; pos integer:=0;
begin
  select * into r from rooms where id=p_room for update;
  if not found then raise exception 'Sala no encontrada'; end if;
  n:=r.round_count+1;
  if n>5 then update rooms set phase='finished' where id=p_room; return; end if;
  select id into previous_round from rounds where room_id=p_room order by number desc limit 1;
  select array_agg(id) into jurors from (
    select p.id from players p where p.room_id=p_room and p.active_from_round<=n
    order by p.jury_rounds,
      case when exists(select 1 from round_players rp where rp.round_id=previous_round and rp.player_id=p.id and rp.role='juror') then 1 else 0 end,
      random()
    limit case when (select count(*) from players where room_id=p_room and active_from_round<=n)>=6 then 2 else 1 end
  ) jury;
  if coalesce(array_length(jurors,1),0) not in (1,2) then raise exception 'No hay suficientes jugadores activos'; end if;
  update players set jury_rounds=jury_rounds+1 where id=any(jurors);
  if ((select count(*) from players where room_id=p_room and active_from_round<=n and not(id=any(jurors)))%2)=1 then
    extra:=case when r.last_odd_extra_side is null then case when random()<.5 then 'A' else 'B' end when r.last_odd_extra_side='A' then 'B' else 'A' end;
  else extra:=null; end if;
  target_a:=floor((select count(*) from players where room_id=p_room and active_from_round<=n and not(id=any(jurors)))/2.0)::int+case when extra='A' then 1 else 0 end;
  prompt:=public.deal_prompt(p_room,r.intensity);
  insert into rounds(room_id,number,prompt_id,phase,ends_at) values(p_room,n,prompt,'debating',now()+interval '60 seconds') returning id into new_round;
  for candidate in
    select p.id from players p
    left join lateral (select side from round_players where round_id=previous_round and player_id=p.id) old on true
    where p.room_id=p_room and p.active_from_round<=n and not(p.id=any(jurors))
    order by case when old.side='B' then 0 when old.side='A' then 1 else 2 end,random()
  loop
    pos:=pos+1;
    insert into round_players(round_id,player_id,role,side)
    values(new_round,candidate.id,'debater',case when pos<=target_a then 'A' else 'B' end);
  end loop;
  insert into round_players(round_id,player_id,role) select new_round,unnest(jurors),'juror';
  update rooms set round_count=n,phase='playing',last_odd_extra_side=coalesce(extra,last_odd_extra_side) where id=p_room;
  insert into events(room_id,name,metadata) values(p_room,'round_started',jsonb_build_object('round',n));
end $$;

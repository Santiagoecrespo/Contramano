-- Fixes the final permission statement from 202608130004_add_resilience.sql.
-- Safe to run on an existing project after that migration reported the
-- join_room(text) signature error. It changes no tables or data.

grant execute on function public.join_room(text,text) to authenticated;

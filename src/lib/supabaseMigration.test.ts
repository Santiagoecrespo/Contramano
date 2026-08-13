import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rootMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/202608120001_realtime_multiplayer.sql'), 'utf8')
const correctiveMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/202608120002_fix_start_new_round_jurors.sql'), 'utf8')

describe('migraciones Supabase de rondas', () => {
  it('inserta jurados con rol explícito en instalaciones nuevas y existentes', () => {
    const insertion = "insert into round_players(round_id,player_id,role) select new_round,unnest(jurors),'juror';"
    expect(rootMigration).toContain(insertion)
    expect(correctiveMigration).toContain(insertion)
    expect(correctiveMigration).toContain('create or replace function public.start_new_round')
  })
})

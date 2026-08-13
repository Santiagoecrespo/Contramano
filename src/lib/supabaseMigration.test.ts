import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { activePrompts, promptPreviews } from '../data/prompts'

const rootMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/202608120001_realtime_multiplayer.sql'), 'utf8')
const correctiveMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/202608120002_fix_start_new_round_jurors.sql'), 'utf8')
const earlyVotingMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/202608130001_allow_host_early_voting.sql'), 'utf8')
const editorialCatalogMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/202608130002_expand_editorial_prompt_catalog.sql'), 'utf8')
const editorialTighteningMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/202608130003_tighten_prompt_conflicts.sql'), 'utf8')
const resilienceMigration = readFileSync(resolve(process.cwd(), 'supabase/migrations/202608130004_add_resilience.sql'), 'utf8')

describe('migraciones Supabase de rondas', () => {
  it('inserta jurados con rol explícito en instalaciones nuevas y existentes', () => {
    const insertion = "insert into round_players(round_id,player_id,role) select new_round,unnest(jurors),'juror';"
    expect(rootMigration).toContain(insertion)
    expect(correctiveMigration).toContain(insertion)
    expect(correctiveMigration).toContain('create or replace function public.start_new_round')
  })

  it('permite al host abrir votación temprana, conserva idempotencia y usa la hora del servidor', () => {
    const advanceFunction = rootMigration.match(/create or replace function public\.advance_to_voting[\s\S]*?end \$\$;/)?.[0] ?? ''
    expect(advanceFunction).not.toContain('now()<current.ends_at')
    expect(advanceFunction).toContain("if current.phase in ('voting','results') then return public.get_room_snapshot")
    expect(advanceFunction).toContain("vote_ends_at=now()+interval '30 seconds'")
    expect(earlyVotingMigration).toContain('create or replace function public.advance_to_voting')
    expect(earlyVotingMigration).not.toContain('now()<current.ends_at')
  })

  it('sincroniza el seed editorial sin borrar historial ni tocar reglas de juego', () => {
    const rows = [...editorialCatalogMigration.matchAll(/^\('([^']+)','([^']+)','(tranqui|bardo)','(active|reserve)'/gm)]
    expect(rows).toHaveLength(160)
    expect(new Set(rows.map((row) => row[1])).size).toBe(160)
    ;(['tranqui', 'bardo'] as const).forEach((intensity) => {
      expect(rows.filter((row) => row[3] === intensity && row[4] === 'active')).toHaveLength(60)
      expect(rows.filter((row) => row[3] === intensity && row[4] === 'reserve')).toHaveLength(20)
      expect(activePrompts(intensity)).toHaveLength(60)
    })
    expect(editorialCatalogMigration).toContain("update public.prompts set status='reserve'")
    expect(editorialCatalogMigration).toContain('on conflict (id) do update')
    expect(editorialCatalogMigration).not.toMatch(/\bdelete\s+from\b/i)
    expect(editorialCatalogMigration).not.toMatch(/row level security/i)
    expect(promptPreviews).toHaveLength(160)
  })

  it('aplica la revisión de conflictos sin alterar IDs ni historial', () => {
    const rows = [...editorialTighteningMigration.matchAll(/^\s+\('([^']+)', '([^']+)', '([^']+)', '([^']+)'\)/gm)]
    expect(rows).toHaveLength(67)
    expect(new Set(rows.map((row) => row[1])).size).toBe(67)
    rows.forEach(([, id, text, sideA, sideB]) => {
      expect(promptPreviews.find((prompt) => prompt.id === id)).toMatchObject({ text, sideA, sideB })
    })
    const rootRows = [...rootMigration.matchAll(/^\s+\('([^']+)', '([^']+)', '([^']+)', '([^']+)'\)/gm)]
    expect(rootRows).toHaveLength(67)
    expect(rootRows.map((row) => row.slice(1, 5))).toEqual(rows.map((row) => row.slice(1, 5)))
    expect(editorialTighteningMigration).toContain("('convivencia-lista', 'El que compra para todos no tiene por qué perseguir transferencias.', 'No tiene por qué', 'Le toca insistir')")
    expect(rootMigration).toContain('Editorial tightening v2')
    expect(rootMigration).toContain('El que compra para todos no tiene por qué perseguir transferencias.')
    expect(editorialTighteningMigration).not.toMatch(/\bdelete\s+from\b/i)
  })

  it('define reconciliación idempotente, heartbeat y pausa en servidor sin debilitar RLS', () => {
    expect(resilienceMigration).toContain("add column if not exists last_seen_at")
    expect(resilienceMigration).toContain("add column if not exists paused_at")
    expect(resilienceMigration).toContain("last_seen_at>=now()-interval '20 seconds'")
    expect(resilienceMigration).toContain("host_seen>=now()-interval '45 seconds'")
    expect(resilienceMigration).toContain("'host_transferred'")
    expect(resilienceMigration).toContain('create or replace function public.heartbeat')
    expect(resilienceMigration).toContain('create or replace function public.reconcile_room')
    expect(resilienceMigration).toContain("current.phase='debating' and now()>=current.ends_at")
    expect(resilienceMigration).toContain("current.phase='voting' and now()>=current.vote_ends_at")
    expect(resilienceMigration).toContain("on conflict(round_id,player_id) do nothing")
    expect(resilienceMigration).toContain("if current.phase='results' then return public.get_room_snapshot")
    expect(resilienceMigration).toContain("if now()<current.ends_at and r.host_player_id<>pid then raise exception 'Sólo el host abre la votación antes de tiempo'")
    expect(resilienceMigration).toContain("if public.connected_player_count(rid)<3 then raise exception 'Todavía faltan jugadores para reanudar'")
    expect(resilienceMigration).not.toMatch(/disable row level security|drop policy|service_role/i)
  })

  it('crea revancha limpia en una sala nueva y conserva el historial anterior', () => {
    expect(resilienceMigration).toContain("insert into public.rooms(code,intensity)")
    expect(resilienceMigration).toContain("where p.room_id=rid and p.last_seen_at>=now()-interval '20 seconds'")
    expect(resilienceMigration).toContain('successor_room_id=new_room')
    expect(resilienceMigration).toContain("'rematch_started'")
    expect(resilienceMigration).not.toMatch(/delete\s+from\s+public\.(rounds|votes|players)/i)
    expect(rootMigration).toContain('Hito 4 base installation')
  })
})

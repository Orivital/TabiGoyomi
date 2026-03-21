import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

type Target = { projectRef: string; poolerHost: string }
type SyncDbTargets = { production: Target; staging: Target }

describe('sync-db-targets.json', () => {
  it('pins production and staging pooler targets for db sync scripts', () => {
    const raw = readFileSync(
      join(repoRoot, 'scripts/sync-db-targets.json'),
      'utf8',
    )
    const targets = JSON.parse(raw) as SyncDbTargets

    expect(targets.production.projectRef).toBe('ssyeychimkqjhzvwucap')
    expect(targets.production.poolerHost).toBe(
      'aws-1-ap-northeast-2.pooler.supabase.com',
    )

    expect(targets.staging.projectRef).toBe('fowxrnfttrnvogssaqef')
    expect(targets.staging.poolerHost).toBe(
      'aws-0-ap-northeast-1.pooler.supabase.com',
    )
  })
})

describe('db-sync-truncate-app-data.sql', () => {
  it('truncates the same app tables used by db-sync-local and db-sync-staging', () => {
    const sql = readFileSync(
      join(repoRoot, 'scripts/db-sync-truncate-app-data.sql'),
      'utf8',
    )
    expect(sql).toMatch(
      /TRUNCATE\s+trip_events,\s*trip_days,\s*trips,\s*allowed_users,\s*event_memories\s+RESTART\s+IDENTITY\s+CASCADE\s*;/,
    )
  })
})

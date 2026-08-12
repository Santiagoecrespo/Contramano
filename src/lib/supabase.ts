/// <reference types="vite/client" />

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && key)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null

export async function ensureAnonymousSession(): Promise<string | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) return session.user.id
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return data.user?.id ?? null
}

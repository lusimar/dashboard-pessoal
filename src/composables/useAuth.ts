import { ref } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './useSupabase'

const session = ref<Session | null>(null)
const user = ref<User | null>(null)
const initialized = ref(false)

let initPromise: Promise<void> | null = null

async function init() {
  const { data } = await supabase.auth.getSession()
  session.value = data.session
  user.value = data.session?.user ?? null
  initialized.value = true

  supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession
    user.value = newSession?.user ?? null
  })
}

export function useAuth() {
  if (!initPromise) initPromise = init()

  async function waitForInit() {
    await initPromise
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { session, user, initialized, waitForInit, signIn, signOut }
}

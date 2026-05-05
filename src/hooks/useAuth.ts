import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchProfile(userId: string) {
    try {
      const { data, error: fetchError } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (fetchError) throw fetchError
      setProfile(data)
    } catch {
      setProfile(null)
      setError('Failed to load profile. Please refresh.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) fetchProfile(session.user.id)
        else setLoading(false)
      })
      .catch(() => {
        setError('Failed to load session. Please refresh.')
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return { profile, loading, error, signOut, refetchProfile: () => profile && fetchProfile(profile.id) }
}

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface Institution {
  id: string
  name: string
  slug: string
  logo_url: string | null
  created_at: string
}

export interface InstitutionMember {
  id: string
  institution_id: string
  user_id: string
  role: 'admin' | 'faculty' | 'student'
  created_at: string
}

export function useInstitution(userId: string | null) {
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [membership, setMembership] = useState<InstitutionMember | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchInstitution(uid: string) {
    setLoading(true)
    // Get membership
    const { data: mem } = await supabase
      .from('institution_members')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle()

    if (!mem) { setLoading(false); return }

    setMembership(mem)

    const { data: inst } = await supabase
      .from('institutions')
      .select('*')
      .eq('id', mem.institution_id)
      .single()

    setInstitution(inst)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (userId) fetchInstitution(userId)
    else setLoading(false)
  }, [userId])

  async function createInstitution(name: string, slug: string, userId: string): Promise<Institution> {
    // Check slug is unique
    const { data: existing } = await supabase.from('institutions').select('id').eq('slug', slug).maybeSingle()
    if (existing) throw new Error('That institution code is already taken. Try a different one.')

    const { data: inst, error } = await supabase.from('institutions').insert({ name, slug }).select('*').single()
    if (error) throw error

    // Add user as admin
    const { error: memError } = await supabase.from('institution_members').insert({
      institution_id: inst.id, user_id: userId, role: 'admin',
    })
    if (memError) throw memError

    // Update profile institution_id
    await supabase.from('profiles').update({ institution_id: inst.id }).eq('id', userId)

    setInstitution(inst)
    setMembership({ id: '', institution_id: inst.id, user_id: userId, role: 'admin', created_at: new Date().toISOString() })
    return inst
  }

  async function joinInstitution(slug: string, userId: string, role: 'faculty' | 'student'): Promise<void> {
    const { data: inst } = await supabase.from('institutions').select('*').eq('slug', slug).maybeSingle()
    if (!inst) throw new Error('Institution not found. Check the code and try again.')

    // Check not already a member
    const { data: existing } = await supabase.from('institution_members').select('id').eq('institution_id', inst.id).eq('user_id', userId).maybeSingle()
    if (existing) throw new Error('You are already a member of this institution.')

    const { error } = await supabase.from('institution_members').insert({
      institution_id: inst.id, user_id: userId, role,
    })
    if (error) throw error

    await supabase.from('profiles').update({ institution_id: inst.id }).eq('id', userId)

    setInstitution(inst)
    setMembership({ id: '', institution_id: inst.id, user_id: userId, role, created_at: new Date().toISOString() })
  }

  return { institution, membership, loading, refetch: () => { if (userId) fetchInstitution(userId) }, createInstitution, joinInstitution }
}

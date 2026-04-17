import { createContext, useContext } from 'react'
import type { Institution, InstitutionMember } from '../hooks/useInstitution'

interface InstitutionContextValue {
  institution: Institution | null
  membership: InstitutionMember | null
  isAdmin: boolean
  isFacultyMember: boolean
  loading: boolean
  refetch: () => void
}

export const InstitutionContext = createContext<InstitutionContextValue>({
  institution: null, membership: null, isAdmin: false,
  isFacultyMember: false, loading: true, refetch: () => {},
})

export function useInstitutionContext() {
  return useContext(InstitutionContext)
}

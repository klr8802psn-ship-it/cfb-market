import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [user, setUser] = useState(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setProfileLoading(!!session?.user)
      setSession(session)
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setProfileLoading(!!session?.user)
      setSession(session)
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setIsPlatformAdmin(false)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)
    supabase
      .from('users')
      .select('is_admin_platform')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsPlatformAdmin(data?.is_admin_platform === true)
        setProfileLoading(false)
      })
      .catch(() => {
        setIsPlatformAdmin(false)
        setProfileLoading(false)
      })
  }, [user?.id])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, user, signOut, isPlatformAdmin, profileLoading, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

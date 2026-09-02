import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// profile = { display_name, ob_handle } from public.users; null until loaded (or if no row yet)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [user, setUser] = useState(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
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

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('display_name, ob_handle, is_admin_platform')
      .eq('id', userId)
      .maybeSingle()
    return data
  }, [])

  useEffect(() => {
    if (!user) {
      setIsPlatformAdmin(false)
      setProfile(null)
      setProfileLoaded(false)
      setProfileLoading(false)
      return
    }

    let cancelled = false
    setProfileLoading(true)
    loadProfile(user.id)
      .then(data => {
        if (cancelled) return
        setIsPlatformAdmin(data?.is_admin_platform === true)
        setProfile(data ? { display_name: data.display_name ?? null, ob_handle: data.ob_handle ?? null } : null)
        setProfileLoaded(true)
        setProfileLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setIsPlatformAdmin(false)
        setProfileLoaded(true)
        setProfileLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.id, loadProfile])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const data = await loadProfile(user.id)
    setProfile(data ? { display_name: data.display_name ?? null, ob_handle: data.ob_handle ?? null } : null)
  }, [user?.id, loadProfile])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{
      session, user, signOut,
      isPlatformAdmin, profileLoading,
      profile, profileLoaded, setProfile, refreshProfile,
      loading: session === undefined,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

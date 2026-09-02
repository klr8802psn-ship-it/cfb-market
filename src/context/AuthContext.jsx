import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// profile = { display_name, ob_handle } from public.users; null until loaded (or if no row yet)
//
// profileLoading is DERIVED: true while we have a user whose profile row hasn't been fetched yet.
// (An earlier version set it from onAuthStateChange, which fires on every token refresh / user
// update and left the flag stuck at true — the admin pages spun forever.)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [user, setUser] = useState(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileForUserId, setProfileForUserId] = useState(null)   // which user the profile/admin state belongs to

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(prev => (prev?.id === session?.user?.id ? prev : (session?.user ?? null)))
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
      setProfileForUserId(null)
      return
    }
    if (profileForUserId === user.id) return   // already loaded for this user

    let cancelled = false
    loadProfile(user.id)
      .then(data => {
        if (cancelled) return
        setIsPlatformAdmin(data?.is_admin_platform === true)
        setProfile(data ? { display_name: data.display_name ?? null, ob_handle: data.ob_handle ?? null } : null)
        setProfileForUserId(user.id)
      })
      .catch(() => {
        if (cancelled) return
        setIsPlatformAdmin(false)
        setProfile(null)
        setProfileForUserId(user.id)
      })
    return () => { cancelled = true }
  }, [user?.id, profileForUserId, loadProfile])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const data = await loadProfile(user.id)
    setProfile(data ? { display_name: data.display_name ?? null, ob_handle: data.ob_handle ?? null } : null)
    setIsPlatformAdmin(data?.is_admin_platform === true)
  }, [user?.id, loadProfile])

  const signOut = () => supabase.auth.signOut()

  const profileLoaded = !!user && profileForUserId === user.id
  const profileLoading = !!user && !profileLoaded

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

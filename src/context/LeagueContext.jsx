import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const LeagueContext = createContext(null)

export function LeagueProvider({ children }) {
  const { user } = useAuth()
  const [league, setLeague] = useState(null)
  const [config, setConfig] = useState(null)
  const [memberLoading, setMemberLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLeague(null)
      setConfig(null)
      setMemberLoading(false)
      return
    }
    setMemberLoading(true)
    // Find leagues the user belongs to that have stock enabled
    supabase
      .from('league_members')
      .select('league_id, leagues(id, name, invite_code)')
      .eq('user_id', user.id)
      .then(async ({ data: memberships }) => {
        if (!memberships?.length) {
          setMemberLoading(false)
          return
        }
        // For each membership, check if stock_config exists and is enabled
        const leagueIds = memberships.map(m => m.league_id)
        const { data: configs } = await supabase
          .from('stock_config')
          .select('league_id, season_id, start_cash, trading_open, enabled')
          .in('league_id', leagueIds)
          .eq('enabled', true)
          .order('created_at', { ascending: false })
          .limit(1)

        if (!configs?.length) {
          setMemberLoading(false)
          return
        }

        const cfg = configs[0]
        const membership = memberships.find(m => m.league_id === cfg.league_id)
        setLeague(membership?.leagues ?? null)
        setConfig(cfg)
        setMemberLoading(false)
      })
      .catch(() => setMemberLoading(false))
  }, [user?.id])

  return (
    <LeagueContext.Provider value={{ league, config, memberLoading, setLeague, setConfig }}>
      {children}
    </LeagueContext.Provider>
  )
}

export function useLeague() {
  const ctx = useContext(LeagueContext)
  if (!ctx) throw new Error('useLeague must be used inside <LeagueProvider>')
  return ctx
}

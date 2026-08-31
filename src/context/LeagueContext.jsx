import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const LeagueContext = createContext(null)

export function LeagueProvider({ children }) {
  const { user } = useAuth()
  const [allLeagues, setAllLeagues] = useState([])  // [{ league, config }]
  const [league, setLeague] = useState(null)
  const [config, setConfig] = useState(null)
  const [memberLoading, setMemberLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setAllLeagues([])
      setLeague(null)
      setConfig(null)
      setMemberLoading(false)
      return
    }
    setMemberLoading(true)

    supabase
      .from('league_members')
      .select('league_id, leagues(id, name, invite_code)')
      .eq('user_id', user.id)
      .then(async ({ data: memberships }) => {
        if (!memberships?.length) { setMemberLoading(false); return }

        const leagueIds = memberships.map(m => m.league_id)
        const { data: configs } = await supabase
          .from('stock_config')
          .select('league_id, season_id, start_cash, trading_open, enabled')
          .in('league_id', leagueIds)
          .eq('enabled', true)
          .order('created_at', { ascending: false })

        if (!configs?.length) { setMemberLoading(false); return }

        const pairs = configs
          .map(cfg => ({
            league: memberships.find(m => m.league_id === cfg.league_id)?.leagues ?? null,
            config: cfg,
          }))
          .filter(p => p.league)

        if (!pairs.length) { setMemberLoading(false); return }

        setAllLeagues(pairs)

        // Restore prior selection from sessionStorage
        const savedId = sessionStorage.getItem('cfbm_league_id')
        const saved = pairs.find(p => p.league.id === savedId)
        const selected = saved ?? pairs[0]
        setLeague(selected.league)
        setConfig(selected.config)
        setMemberLoading(false)
      })
      .catch(() => setMemberLoading(false))
  }, [user?.id])

  function selectLeague(leagueId) {
    const pair = allLeagues.find(p => p.league.id === leagueId)
    if (!pair) return
    sessionStorage.setItem('cfbm_league_id', leagueId)
    setLeague(pair.league)
    setConfig(pair.config)
  }

  return (
    <LeagueContext.Provider value={{ allLeagues, league, config, memberLoading, setLeague, setConfig, selectLeague }}>
      {children}
    </LeagueContext.Provider>
  )
}

export function useLeague() {
  const ctx = useContext(LeagueContext)
  if (!ctx) throw new Error('useLeague must be used inside <LeagueProvider>')
  return ctx
}

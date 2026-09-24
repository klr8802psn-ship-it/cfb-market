// Weekly recap: how each portfolio moved in the most recent settle.
//
// "This week" = current holdings valued at the latest settle vs the previous
// settle. Cash is the same on both sides, so trades made since the settle only
// shift which positions count, not the math. Same basis as the leaderboard's
// rank-movement arrows, so the recap and the leaderboard always agree.
import { portfolioValue } from './stocks.js'

export function rankPortfolios({ members, accounts, allHoldings, priceByTeam, prevPriceByTeam, startCash }) {
  const prevPrices = Object.fromEntries(Object.keys(priceByTeam).map(id => [id, prevPriceByTeam[id] ?? priceByTeam[id]]))
  const rows = members.map(m => {
    const acct = accounts.find(a => a.user_id === m.user_id)
    const cash = acct ? Number(acct.cash) : startCash
    const holdings = allHoldings.filter(h => h.user_id === m.user_id).map(h => ({ team_id: h.team_id, shares: h.shares }))
    const total = portfolioValue({ cash, holdings, priceByTeam })
    const prevTotal = portfolioValue({ cash, holdings, priceByTeam: prevPrices })
    const top = [...holdings].sort((a, b) => (b.shares * (priceByTeam[b.team_id] ?? 0)) - (a.shares * (priceByTeam[a.team_id] ?? 0))).slice(0, 3)
    return { ...m, cash, holdings, total, prevTotal, weekChange: total - prevTotal, pl: total - startCash, top }
  })
  const byPrev = [...rows].sort((a, b) => b.prevTotal - a.prevTotal).map(r => r.user_id)
  return rows.sort((a, b) => b.total - a.total).map((r, i) => ({ ...r, rank: i + 1, prevRank: byPrev.indexOf(r.user_id) + 1 }))
}

// Per-position dollar move in the last settle. Shorts (negative shares) gain when price falls.
function positionMoves(holdings, priceByTeam, prevPriceByTeam) {
  return holdings
    .filter(h => h.shares !== 0 && priceByTeam[h.team_id] != null && prevPriceByTeam[h.team_id] != null)
    .map(h => ({ team_id: h.team_id, shares: h.shares, change: h.shares * (priceByTeam[h.team_id] - prevPriceByTeam[h.team_id]) }))
    .filter(m => m.change !== 0)
    .sort((a, b) => b.change - a.change)
}

// Returns null when there's nothing to recap (no prior settle, or user not ranked).
export function buildWeeklyRecap({ ranked, userId, priceByTeam, prevPriceByTeam }) {
  if (!Object.keys(prevPriceByTeam).length) return null
  const me = ranked.find(r => r.user_id === userId)
  if (!me) return null

  const moves = positionMoves(me.holdings, priceByTeam, prevPriceByTeam)
  const best = moves.length && moves[0].change > 0 ? moves[0] : null
  const worst = moves.length && moves[moves.length - 1].change < 0 ? moves[moves.length - 1] : null

  const leagueBest = ranked.length > 1
    ? [...ranked].sort((a, b) => b.weekChange - a.weekChange)[0]
    : null

  return {
    rank: me.rank,
    prevRank: me.prevRank,
    count: ranked.length,
    total: me.total,
    weekChange: me.weekChange,
    weekPct: me.prevTotal ? (me.weekChange / me.prevTotal) * 100 : 0,
    best,
    worst,
    leagueBest: leagueBest && leagueBest.weekChange > 0
      ? { user_id: leagueBest.user_id, display_name: leagueBest.display_name, weekChange: leagueBest.weekChange }
      : null,
  }
}

export function inviteUrl(origin, code) {
  return `${origin}/join/${encodeURIComponent(code)}`
}

export function recapShareText({ recap, leagueName, url }) {
  const pct = Math.abs(recap.weekPct).toFixed(1)
  const move = recap.weekChange > 0 ? `up ${pct}%` : recap.weekChange < 0 ? `down ${pct}%` : 'flat'
  return `I'm #${recap.rank} of ${recap.count} in ${leagueName} on CFB Market (${move} this week). Think you can pick teams better? Join the league: ${url}`
}

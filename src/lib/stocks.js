export const STOCK_START_CASH = 2000
export const POSITION_CAP = 0.40

export function holdingsValue(holdings, priceByTeam) {
  return holdings.reduce((sum, { team_id, shares }) => {
    const price = priceByTeam[team_id] ?? 0
    return sum + shares * price
  }, 0)
}

export function portfolioValue({ cash, holdings, priceByTeam }) {
  return cash + holdingsValue(holdings, priceByTeam)
}

export function validateBuy({ cash, holdings, priceByTeam, teamId, shares }) {
  if (!Number.isInteger(shares) || shares <= 0)
    return { ok: false, reason: 'shares must be a positive integer' }

  const price = priceByTeam[teamId] ?? 0
  const cost = shares * price
  if (cost > cash) return { ok: false, reason: 'insufficient cash' }

  const cashAfter = cash - cost
  const holdingsAfter = holdings.map(h => ({ ...h }))
  const existing = holdingsAfter.find(h => h.team_id === teamId)
  if (existing) existing.shares += shares
  else holdingsAfter.push({ team_id: teamId, shares })

  const postPortfolio = portfolioValue({ cash: cashAfter, holdings: holdingsAfter, priceByTeam })
  const sharesAfter = existing ? existing.shares : shares
  const holdingVal = sharesAfter * price

  if (holdingVal > POSITION_CAP * postPortfolio + 1e-9)
    return { ok: false, reason: 'exceeds position cap (40% of portfolio)' }

  return { ok: true }
}

export function validateSell({ holdings, teamId, shares }) {
  if (!Number.isInteger(shares) || shares <= 0)
    return { ok: false, reason: 'shares must be a positive integer' }

  const held = holdings.find(h => h.team_id === teamId)?.shares ?? 0
  if (shares > held) return { ok: false, reason: 'cannot sell more shares than held' }

  return { ok: true }
}

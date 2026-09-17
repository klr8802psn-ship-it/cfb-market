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

  const held = holdings.find(h => h.team_id === teamId)?.shares ?? 0

  const cashAfter = cash - cost
  const holdingsAfter = holdings.map(h => ({ ...h }))
  const existing = holdingsAfter.find(h => h.team_id === teamId)
  if (existing) existing.shares += shares
  else holdingsAfter.push({ team_id: teamId, shares })

  const postPortfolio = portfolioValue({ cash: cashAfter, holdings: holdingsAfter, priceByTeam })
  const sharesAfter = existing ? existing.shares : shares
  const holdingVal = sharesAfter * price

  // The cap only blocks trades that INCREASE exposure. Covering part of a
  // short (reducing |shares| toward 0) is never blocked, however large the
  // existing short is — matches the shared RPC's identical rule.
  if (Math.abs(sharesAfter) > Math.abs(held) && Math.abs(holdingVal) > POSITION_CAP * postPortfolio + 1e-9)
    return { ok: false, reason: 'exceeds position cap (40% of portfolio)' }

  return { ok: true }
}

// Largest buy that satisfies both the cash constraint and the position cap.
// Buying converts cash → shares at the same price, so portfolio value is unchanged by the trade,
// which makes the cap a simple closed form.
export function maxBuyShares({ cash, holdings, priceByTeam, teamId }) {
  const price = priceByTeam[teamId] ?? 0
  if (price <= 0) return 0
  const held = holdings.find(h => h.team_id === teamId)?.shares ?? 0
  const portfolio = portfolioValue({ cash, holdings, priceByTeam })
  const byCash = Math.floor(cash / price)
  const byCap = Math.floor((POSITION_CAP * portfolio + 1e-9) / price) - held
  return Math.max(0, Math.min(byCash, byCap))
}

// Largest sell that satisfies the position cap (can open or extend a short).
// Selling always subtracts shares and always adds cash proceeds, regardless of position sign.
// Covering a short is done via buy, never sell — so a sell when already short extends the short.
export function maxSellShares({ cash, holdings, priceByTeam, teamId }) {
  const price = priceByTeam[teamId] ?? 0
  if (price <= 0) return 0
  const held = holdings.find(h => h.team_id === teamId)?.shares ?? 0
  const portfolio = portfolioValue({ cash, holdings, priceByTeam })
  const capRoom = Math.floor((POSITION_CAP * portfolio + 1e-9) / price)
  return Math.max(0, held + capRoom)
}

export function validateSell({ cash, holdings, priceByTeam, teamId, shares }) {
  if (!Number.isInteger(shares) || shares <= 0)
    return { ok: false, reason: 'shares must be a positive integer' }

  const price = priceByTeam[teamId] ?? 0
  const held = holdings.find(h => h.team_id === teamId)?.shares ?? 0

  // Selling always subtracts shares and always adds cash proceeds.
  // sharesAfter = held - shares (unconditional, whether going long → short or extending short)
  // cashAfter = cash + shares * price (unconditional proceeds)
  const sharesAfter = held - shares
  const cashAfter = cash + shares * price

  // Build the post-trade holdings
  const holdingsAfter = holdings.map(h => ({ ...h }))
  const existing = holdingsAfter.find(h => h.team_id === teamId)
  if (existing) existing.shares = sharesAfter
  else holdingsAfter.push({ team_id: teamId, shares: sharesAfter })

  const postPortfolio = portfolioValue({ cash: cashAfter, holdings: holdingsAfter, priceByTeam })
  const holdingVal = sharesAfter * price

  // Position cap: absolute value of holding must not exceed 40% of portfolio
  // The cap only blocks trades that INCREASE exposure. Trimming part of an
  // over-cap long (reducing |shares| toward 0) is never blocked, however
  // large the existing position is — matches the shared RPC's identical rule.
  if (Math.abs(sharesAfter) > Math.abs(held) && Math.abs(holdingVal) > POSITION_CAP * postPortfolio + 1e-9)
    return { ok: false, reason: 'exceeds position cap (40% of portfolio)' }

  return { ok: true }
}

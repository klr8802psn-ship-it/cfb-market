export const STOCK_START_CASH = 2000
export const POSITION_CAP = 0.40
// Longs plus shorts (at market value) can't exceed portfolio value. Without this, short-sale
// proceeds fund more buys and leverage is unbounded. Same rule as the stock_trade RPC.
export const EXPOSURE_CAP = 1.0

export function holdingsValue(holdings, priceByTeam) {
  return holdings.reduce((sum, { team_id, shares }) => {
    const price = priceByTeam[team_id] ?? 0
    return sum + shares * price
  }, 0)
}

export function portfolioValue({ cash, holdings, priceByTeam }) {
  return cash + holdingsValue(holdings, priceByTeam)
}

// Total size of all bets: |long value| + |short value|.
export function grossExposure(holdings, priceByTeam) {
  return holdings.reduce((sum, { team_id, shares }) => sum + Math.abs(shares * (priceByTeam[team_id] ?? 0)), 0)
}

// Largest |shares| this team can reach before total exposure hits the cap, given every other position.
function exposureRoomShares({ holdings, priceByTeam, teamId, portfolio }) {
  const price = priceByTeam[teamId] ?? 0
  const held = holdings.find(h => h.team_id === teamId)?.shares ?? 0
  const others = grossExposure(holdings, priceByTeam) - Math.abs(held * price)
  return Math.floor((EXPOSURE_CAP * portfolio - others + 1e-9) / price)
}

// Only blocks trades that grow total exposure; shrinking a position is always allowed.
function exposureError(holdings, holdingsAfter, priceByTeam, portfolio) {
  const before = grossExposure(holdings, priceByTeam)
  const after = grossExposure(holdingsAfter, priceByTeam)
  if (after > before + 1e-9 && after > EXPOSURE_CAP * portfolio + 1e-9)
    return { ok: false, reason: 'exceeds exposure limit (longs + shorts can\'t top your portfolio value)' }
  return null
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

  return exposureError(holdings, holdingsAfter, priceByTeam, postPortfolio) ?? { ok: true }
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
  // Covering a short always shrinks exposure, so it's allowed even when over the limit.
  const byExposure = Math.max(exposureRoomShares({ holdings, priceByTeam, teamId, portfolio }) - held, held < 0 ? -held : 0)
  return Math.max(0, Math.min(byCash, byCap, byExposure))
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
  // Selling down a long always shrinks exposure, so it's allowed even when over the limit.
  const byExposure = Math.max(held + exposureRoomShares({ holdings, priceByTeam, teamId, portfolio }), held > 0 ? held : 0)
  return Math.max(0, Math.min(held + capRoom, byExposure))
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

  return exposureError(holdings, holdingsAfter, priceByTeam, postPortfolio) ?? { ok: true }
}

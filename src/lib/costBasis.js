// Cost basis per team from a user's trade history (moving-average method).
//
// buildCostBasis(transactions) → { [team_id]: { shares, avgCost, totalCost } }
//   - transactions: [{ team_id, side: 'buy'|'sell'|'auto_cover', shares, price, created_at }]
//     ('auto_cover' is a forced close of an underwater short — treated as a buy-direction
//     trade, same as a voluntary cover, since that's what it economically is)
//   - Processed in chronological order. avgCost changes when a trade extends the
//     position in its current direction (long or short) and resets to the trade
//     price when a trade crosses through zero; it stays fixed when a trade only
//     reduces the position without crossing zero.
//
// positionPL({ shares, avgCost, price }) → { value, cost, pl, plPct }

export function buildCostBasis(transactions) {
  const rows = [...(transactions ?? [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const basis = {}
  for (const tx of rows) {
    const shares = Number(tx.shares) || 0
    const price = Number(tx.price) || 0
    if (shares <= 0) continue
    const cur = basis[tx.team_id] ?? { shares: 0, totalCost: 0, avgCost: 0 }
    const signedShares = (tx.side === 'buy' || tx.side === 'auto_cover') ? shares : -shares

    const sameDirection = cur.shares === 0 || Math.sign(cur.shares) === Math.sign(signedShares)

    if (sameDirection) {
      // Extending (or opening) a position in the same direction: average the cost in.
      cur.totalCost += signedShares * price
      cur.shares += signedShares
    } else if (Math.abs(signedShares) <= Math.abs(cur.shares)) {
      // Reducing the position without crossing zero: avg cost on the remaining
      // shares doesn't change (moving-average method — only a same-direction
      // trade changes avgCost).
      const avg = cur.totalCost / cur.shares
      cur.shares += signedShares
      cur.totalCost = cur.shares * avg
    } else {
      // Crosses through zero: close out the existing leg entirely, then open
      // a fresh leg in the new direction, priced at this trade.
      const remainder = signedShares + cur.shares // shares left over after fully closing cur
      cur.shares = remainder
      cur.totalCost = remainder * price
    }

    cur.avgCost = cur.shares !== 0 ? cur.totalCost / cur.shares : 0
    basis[tx.team_id] = cur
  }
  return basis
}

export function positionPL({ shares, avgCost, price }) {
  const s = Number(shares) || 0
  const p = Number(price) || 0
  const c = Number(avgCost) || 0
  const value = s * p
  const cost = s * c
  const pl = value - cost
  const denom = Math.abs(cost)
  const plPct = denom > 0 ? (pl / denom) * 100 : 0
  return { value, cost, pl, plPct }
}

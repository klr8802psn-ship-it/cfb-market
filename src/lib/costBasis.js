// Cost basis per team from a user's trade history (moving-average method).
//
// buildCostBasis(transactions) → { [team_id]: { shares, avgCost, totalCost } }
//   - transactions: [{ team_id, side: 'buy'|'sell', shares, price, created_at }]
//   - Processed in chronological order. Sells reduce cost at the running average,
//     so avgCost never changes on a sell (only on a buy).
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
    if (tx.side === 'buy') {
      cur.totalCost += shares * price
      cur.shares += shares
    } else if (tx.side === 'sell') {
      const avg = cur.shares > 0 ? cur.totalCost / cur.shares : 0
      const sold = Math.min(shares, cur.shares)
      cur.totalCost -= sold * avg
      cur.shares -= sold
      if (cur.shares === 0) cur.totalCost = 0
    }
    cur.avgCost = cur.shares > 0 ? cur.totalCost / cur.shares : 0
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
  const plPct = cost > 0 ? (pl / cost) * 100 : 0
  return { value, cost, pl, plPct }
}

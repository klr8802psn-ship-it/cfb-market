import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maxBuyShares, maxSellShares, validateBuy, validateSell, grossExposure, portfolioValue, freeToInvest, shortValue } from '../src/lib/stocks.js'

const A = 'a', B = 'b'

test('maxBuyShares is limited by cash when cap is not binding', () => {
  // $2000 cash, no holdings, price $100 → cash allows 20, cap allows 40% of 2000 = $800 → 8
  const n = maxBuyShares({ cash: 2000, holdings: [], priceByTeam: { [A]: 100 }, teamId: A })
  assert.equal(n, 8)
})

test('maxBuyShares is limited by cash when price is high relative to portfolio share', () => {
  // $500 cash, $1500 in B → portfolio $2000, cap $800 → 8 shares by cap, cash allows 5
  const n = maxBuyShares({ cash: 500, holdings: [{ team_id: B, shares: 15 }], priceByTeam: { [A]: 100, [B]: 100 }, teamId: A })
  assert.equal(n, 5)
})

test('maxBuyShares subtracts shares already held', () => {
  // portfolio = 1600 cash + 4×100 = 2000 → cap 8 total → 4 more
  const n = maxBuyShares({ cash: 1600, holdings: [{ team_id: A, shares: 4 }], priceByTeam: { [A]: 100 }, teamId: A })
  assert.equal(n, 4)
})

test('maxBuyShares never goes negative or divides by zero', () => {
  assert.equal(maxBuyShares({ cash: 100, holdings: [{ team_id: A, shares: 50 }], priceByTeam: { [A]: 100 }, teamId: A }), 0)
  assert.equal(maxBuyShares({ cash: 100, holdings: [], priceByTeam: {}, teamId: A }), 0)
})

test('the max from maxBuyShares passes validateBuy and max+1 fails', () => {
  const state = { cash: 2000, holdings: [{ team_id: B, shares: 3 }], priceByTeam: { [A]: 73, [B]: 120 } }
  const n = maxBuyShares({ ...state, teamId: A })
  assert.ok(n > 0)
  assert.equal(validateBuy({ ...state, teamId: A, shares: n }).ok, true)
  assert.equal(validateBuy({ ...state, teamId: A, shares: n + 1 }).ok, false)
})

test('validateSell allows selling past zero to open a short, within the cap', () => {
  const r = validateSell({ cash: 2000, holdings: [], priceByTeam: { [A]: 100 }, teamId: A, shares: 5 })
  assert.equal(r.ok, true)
})

test('validateSell rejects a short that would breach the 40% cap', () => {
  const r = validateSell({ cash: 2000, holdings: [], priceByTeam: { [A]: 100 }, teamId: A, shares: 10 })
  assert.equal(r.ok, false)
  assert.match(r.reason, /cap/i)
})

test('validateSell extends an existing short further, within the cap', () => {
  // Selling always subtracts from held (a "sell" while already short extends the short —
  // covering is done via validateBuy, never validateSell). held=-5, sell 2 more → -7.
  // cashAfter = 5000+200=5200, postPortfolio = 5200 + (-7*100) = 4500, holdingVal=-700,
  // cap = 0.4*4500 = 1800 — well within cap.
  const r = validateSell({ cash: 5000, holdings: [{ team_id: A, shares: -5 }], priceByTeam: { [A]: 100 }, teamId: A, shares: 2 })
  assert.equal(r.ok, true)
})

test('maxSellShares is bounded only by the position cap, not by shares held', () => {
  const n = maxSellShares({ cash: 2000, holdings: [], priceByTeam: { [A]: 100 }, teamId: A })
  assert.equal(n, 8)
})

test('maxSellShares adds held long shares to the short-side cap room', () => {
  // Holding 3 long at $100 makes the portfolio 2000+300=2300, not just the $2000 cash — the
  // cap must be computed off total portfolio value, same as maxBuyShares. cap room =
  // floor(0.4*2300/100) = 9. Plus the 3 already held (sell those 3 to flatten first) = 12.
  const n = maxSellShares({ cash: 2000, holdings: [{ team_id: A, shares: 3 }], priceByTeam: { [A]: 100 }, teamId: A })
  assert.equal(n, 12)
})

test('validateSell always allows reducing an over-cap long, even while still over cap after', () => {
  // held=10 @ $100 with cash=100 → portfolio=1100, cap=$440, position=$1000 — already over cap.
  // Selling 1 leaves 9 shares ($900) — still over the $440 cap, but SMALLER than before, so it
  // must be allowed: the cap only blocks trades that increase exposure, never ones that shrink it.
  const r = validateSell({ cash: 100, holdings: [{ team_id: A, shares: 10 }], priceByTeam: { [A]: 100 }, teamId: A, shares: 1 })
  assert.equal(r.ok, true)
})

test('validateBuy always allows covering an over-cap short, even while still over cap after', () => {
  const r = validateBuy({ cash: 3000, holdings: [{ team_id: A, shares: -10 }], priceByTeam: { [A]: 100 }, teamId: A, shares: 1 })
  assert.equal(r.ok, true)
})

// ── Exposure limit: longs + shorts can't exceed portfolio value ──────────────
const twenty = Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['T' + i, 100]))

test('short proceeds cannot fund unlimited longs (greedy max-out stays at 1x)', () => {
  let cash = 5000
  const holdings = []
  const apply = (t, d) => { const h = holdings.find(x => x.team_id === t); if (h) h.shares += d; else holdings.push({ team_id: t, shares: d }); cash -= d * 100 }
  for (let i = 0; i < 10; i++) { const n = maxSellShares({ cash, holdings, priceByTeam: twenty, teamId: 'T' + i }); if (n) apply('T' + i, -n) }
  for (let i = 10; i < 20; i++) { const n = maxBuyShares({ cash, holdings, priceByTeam: twenty, teamId: 'T' + i }); if (n) apply('T' + i, n) }
  assert.ok(grossExposure(holdings, twenty) <= 5000 + 1e-9)
  assert.equal(portfolioValue({ cash, holdings, priceByTeam: twenty }), 5000)
})

test('validateBuy rejects a long funded by short proceeds past the limit', () => {
  // $5000 portfolio: short $2000 of T0, long $2000 of T1 → gross $4000. Another $2000 long → $6000.
  const holdings = [{ team_id: 'T0', shares: -20 }, { team_id: 'T1', shares: 20 }]
  const r = validateBuy({ cash: 5000, holdings, priceByTeam: twenty, teamId: 'T2', shares: 20 })
  assert.equal(r.ok, false)
  assert.match(r.reason, /exposure/)
  assert.equal(maxBuyShares({ cash: 5000, holdings, priceByTeam: twenty, teamId: 'T2' }), 10)
  assert.equal(validateBuy({ cash: 5000, holdings, priceByTeam: twenty, teamId: 'T2', shares: 10 }).ok, true)
})

test('validateSell rejects a new short past the limit', () => {
  const holdings = [{ team_id: 'T1', shares: 20 }, { team_id: 'T2', shares: 20 }]  // $4000 long, $1000 cash
  assert.equal(maxSellShares({ cash: 1000, holdings, priceByTeam: twenty, teamId: 'T0' }), 10)
  assert.equal(validateSell({ cash: 1000, holdings, priceByTeam: twenty, teamId: 'T0', shares: 11 }).ok, false)
})

test('over-leveraged accounts can still shrink positions', () => {
  // $5000 net = $1000 cash + $10k long - $6k short (3.2x): shaped like the real account this guards against.
  const holdings = [{ team_id: 'T0', shares: -60 }, { team_id: 'T1', shares: 40 }, { team_id: 'T2', shares: 40 }, { team_id: 'T3', shares: 20 }]
  const cash = 1000
  assert.equal(portfolioValue({ cash, holdings, priceByTeam: twenty }), 5000)
  assert.equal(validateBuy({ cash, holdings, priceByTeam: twenty, teamId: 'T0', shares: 10 }).ok, true)   // cover
  assert.equal(validateSell({ cash, holdings, priceByTeam: twenty, teamId: 'T1', shares: 10 }).ok, true)  // trim long
  assert.equal(validateBuy({ cash, holdings, priceByTeam: twenty, teamId: 'T4', shares: 1 }).ok, false)   // new long
  assert.equal(validateSell({ cash, holdings, priceByTeam: twenty, teamId: 'T5', shares: 1 }).ok, false)  // new short
  assert.equal(maxBuyShares({ cash, holdings, priceByTeam: twenty, teamId: 'T0' }), 10)   // cash-bound cover
  assert.equal(maxSellShares({ cash, holdings, priceByTeam: twenty, teamId: 'T1' }), 40)
  assert.equal(maxSellShares({ cash, holdings, priceByTeam: twenty, teamId: 'T5' }), 0)
})

test('freeToInvest excludes short proceeds and respects the exposure limit', () => {
  // Kenny-shaped: $852 own cash + $798 short proceeds, $4281 long, short 6 @ $133.
  const priceByTeam = { L: 4281, S: 133 }
  const holdings = [{ team_id: 'L', shares: 1 }, { team_id: 'S', shares: -6 }]
  assert.equal(shortValue(holdings, priceByTeam), 798)
  assert.equal(freeToInvest({ cash: 1650, holdings, priceByTeam }), 54)
  assert.equal(freeToInvest({ cash: 2000, holdings: [], priceByTeam }), 2000)
  // Over the limit → nothing free, never negative
  assert.equal(freeToInvest({ cash: 1000, holdings: [{ team_id: 'L', shares: 2 }, { team_id: 'S', shares: -60 }], priceByTeam }), 0)
})

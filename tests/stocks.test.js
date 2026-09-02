import { test } from 'node:test'
import assert from 'node:assert/strict'
import { maxBuyShares, validateBuy } from '../src/lib/stocks.js'

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

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCostBasis, positionPL } from '../src/lib/costBasis.js'

const T = 'team-a'
const tx = (side, shares, price, t) => ({ team_id: T, side, shares, price, created_at: t })

test('single buy sets avg cost to purchase price', () => {
  const b = buildCostBasis([tx('buy', 5, 100, '2026-09-01T00:00:00Z')])
  assert.equal(b[T].shares, 5)
  assert.equal(b[T].avgCost, 100)
  assert.equal(b[T].totalCost, 500)
})

test('two buys at different prices average', () => {
  const b = buildCostBasis([
    tx('buy', 5, 100, '2026-09-01T00:00:00Z'),
    tx('buy', 5, 120, '2026-09-02T00:00:00Z'),
  ])
  assert.equal(b[T].shares, 10)
  assert.equal(b[T].avgCost, 110)
})

test('sell reduces shares but keeps avg cost', () => {
  const b = buildCostBasis([
    tx('buy', 10, 100, '2026-09-01T00:00:00Z'),
    tx('buy', 10, 120, '2026-09-02T00:00:00Z'),
    tx('sell', 5, 150, '2026-09-03T00:00:00Z'),
  ])
  assert.equal(b[T].shares, 15)
  assert.equal(b[T].avgCost, 110)
  assert.equal(b[T].totalCost, 1650)
})

test('selling everything zeroes the position', () => {
  const b = buildCostBasis([
    tx('buy', 4, 50, '2026-09-01T00:00:00Z'),
    tx('sell', 4, 60, '2026-09-02T00:00:00Z'),
  ])
  assert.equal(b[T].shares, 0)
  assert.equal(b[T].totalCost, 0)
  assert.equal(b[T].avgCost, 0)
})

test('out-of-order input is sorted chronologically', () => {
  const b = buildCostBasis([
    tx('sell', 5, 150, '2026-09-03T00:00:00Z'),
    tx('buy', 10, 120, '2026-09-02T00:00:00Z'),
    tx('buy', 10, 100, '2026-09-01T00:00:00Z'),
  ])
  assert.equal(b[T].shares, 15)
  assert.equal(b[T].avgCost, 110)
})

test('sell larger than held opens a short rather than clamping at zero', () => {
  const b = buildCostBasis([
    tx('buy', 2, 100, '2026-09-01T00:00:00Z'),
    tx('sell', 5, 100, '2026-09-02T00:00:00Z'),
  ])
  assert.equal(b[T].shares, -3)
})

test('selling past a long position opens a short leg at the crossing price', () => {
  const b = buildCostBasis([
    tx('buy', 5, 100, '2026-09-01T00:00:00Z'),
    tx('sell', 8, 120, '2026-09-02T00:00:00Z'), // closes 5 long, opens 3 short at 120
  ])
  assert.equal(b[T].shares, -3)
  assert.equal(b[T].avgCost, 120)
  assert.equal(b[T].totalCost, -360)
})

test('buying past a short position closes it and opens a long leg at the crossing price', () => {
  const b = buildCostBasis([
    tx('sell', 5, 100, '2026-09-01T00:00:00Z'),  // opens -5 short @ 100
    tx('buy', 8, 80, '2026-09-02T00:00:00Z'),    // covers 5, opens 3 long @ 80
  ])
  assert.equal(b[T].shares, 3)
  assert.equal(b[T].avgCost, 80)
  assert.equal(b[T].totalCost, 240)
})

test('extending an existing short averages the short entry price', () => {
  const b = buildCostBasis([
    tx('sell', 5, 100, '2026-09-01T00:00:00Z'),
    tx('sell', 5, 120, '2026-09-02T00:00:00Z'),
  ])
  assert.equal(b[T].shares, -10)
  assert.equal(b[T].avgCost, 110)
})

test('partially covering a short keeps the short avg cost unchanged', () => {
  const b = buildCostBasis([
    tx('sell', 10, 100, '2026-09-01T00:00:00Z'),
    tx('buy', 4, 90, '2026-09-02T00:00:00Z'),
  ])
  assert.equal(b[T].shares, -6)
  assert.equal(b[T].avgCost, 100)
})

test('positionPL computes value, cost, pl and pct', () => {
  const r = positionPL({ shares: 10, avgCost: 100, price: 125 })
  assert.equal(r.value, 1250)
  assert.equal(r.cost, 1000)
  assert.equal(r.pl, 250)
  assert.equal(r.plPct, 25)
})

test('positionPL with zero cost has 0 pct', () => {
  const r = positionPL({ shares: 0, avgCost: 0, price: 125 })
  assert.equal(r.pl, 0)
  assert.equal(r.plPct, 0)
})

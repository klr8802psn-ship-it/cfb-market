import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankPortfolios, buildWeeklyRecap, inviteUrl, recapShareText } from '../src/lib/recap.js'

const members = [
  { user_id: 'a', display_name: 'Ann' },
  { user_id: 'b', display_name: 'Bo' },
  { user_id: 'c', display_name: 'Cy' },
]
const accounts = [{ user_id: 'a', cash: 1000 }, { user_id: 'b', cash: 1000 }, { user_id: 'c', cash: 2000 }]
const allHoldings = [
  { user_id: 'a', team_id: 'X', shares: 10 },  // X: 100 -> 90
  { user_id: 'b', team_id: 'Y', shares: 10 },  // Y: 100 -> 120
  { user_id: 'b', team_id: 'X', shares: -2 },  // short X gains 20
]
const priceByTeam = { X: 90, Y: 120 }
const prevPriceByTeam = { X: 100, Y: 100 }
const ranked = rankPortfolios({ members, accounts, allHoldings, priceByTeam, prevPriceByTeam, startCash: 2000 })

test('rankPortfolios ranks by current value and tracks prior rank', () => {
  assert.deepEqual(ranked.map(r => r.user_id), ['b', 'c', 'a'])
  const b = ranked.find(r => r.user_id === 'b')
  assert.equal(b.total, 1000 + 1200 - 180)
  assert.equal(b.weekChange, 200 + 20)
  assert.equal(b.prevRank, 3)  // before the settle: a 2000, c 2000, b 1800
  const a = ranked.find(r => r.user_id === 'a')
  assert.equal(a.weekChange, -100)
})

test('buildWeeklyRecap picks best/worst positions and league leader', () => {
  const r = buildWeeklyRecap({ ranked, userId: 'b', priceByTeam, prevPriceByTeam })
  assert.equal(r.rank, 1)
  assert.equal(r.count, 3)
  assert.equal(r.best.team_id, 'Y')
  assert.equal(r.best.change, 200)
  assert.equal(r.worst, null)  // the short on X made money
  assert.equal(r.leagueBest.user_id, 'b')
  assert.ok(Math.abs(r.weekPct - (220 / 1800) * 100) < 1e-9)
})

test('buildWeeklyRecap reports a losing position as worst', () => {
  const r = buildWeeklyRecap({ ranked, userId: 'a', priceByTeam, prevPriceByTeam })
  assert.equal(r.best, null)
  assert.equal(r.worst.team_id, 'X')
  assert.equal(r.worst.change, -100)
})

test('buildWeeklyRecap returns null before the second settle or for non-members', () => {
  assert.equal(buildWeeklyRecap({ ranked, userId: 'b', priceByTeam, prevPriceByTeam: {} }), null)
  assert.equal(buildWeeklyRecap({ ranked, userId: 'zzz', priceByTeam, prevPriceByTeam }), null)
})

test('leagueBest is null when nobody gained', () => {
  const flat = rankPortfolios({ members, accounts, allHoldings: [], priceByTeam, prevPriceByTeam, startCash: 2000 })
  const r = buildWeeklyRecap({ ranked: flat, userId: 'a', priceByTeam, prevPriceByTeam })
  assert.equal(r.leagueBest, null)
  assert.equal(r.weekChange, 0)
})

test('share text and invite url', () => {
  const url = inviteUrl('https://cfb-market.vercel.app', 'orangebloods')
  assert.equal(url, 'https://cfb-market.vercel.app/join/orangebloods')
  const text = recapShareText({ recap: { rank: 3, count: 10, weekPct: -4.25, weekChange: -85 }, leagueName: 'Orangebloods', url })
  assert.match(text, /#3 of 10 in Orangebloods/)
  assert.match(text, /down 4\.3% this week/)
  assert.ok(text.endsWith(url))
})

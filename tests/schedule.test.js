import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextClose, nextOpen, formatCountdown } from '../src/lib/schedule.js'

// 2026-09-02 is a Wednesday.
const WED = new Date('2026-09-02T14:00:00Z')

test('nextClose from Wednesday is Thursday 23:00 UTC', () => {
  assert.equal(nextClose(WED).toISOString(), '2026-09-03T23:00:00.000Z')
})

test('nextOpen from Wednesday is the following Monday 10:00 UTC', () => {
  assert.equal(nextOpen(WED).toISOString(), '2026-09-07T10:00:00.000Z')
})

test('nextClose exactly at close time rolls to next week', () => {
  const at = new Date('2026-09-03T23:00:00Z')
  assert.equal(nextClose(at).toISOString(), '2026-09-10T23:00:00.000Z')
})

test('nextClose one minute before close is today', () => {
  const at = new Date('2026-09-03T22:59:00Z')
  assert.equal(nextClose(at).toISOString(), '2026-09-03T23:00:00.000Z')
})

test('nextOpen on Monday before 10:00 UTC is that same Monday', () => {
  const at = new Date('2026-09-07T05:00:00Z')
  assert.equal(nextOpen(at).toISOString(), '2026-09-07T10:00:00.000Z')
})

test('nextOpen on Monday after 10:00 UTC is next Monday', () => {
  const at = new Date('2026-09-07T12:00:00Z')
  assert.equal(nextOpen(at).toISOString(), '2026-09-14T10:00:00.000Z')
})

test('formatCountdown renders days/hours, hours/minutes, minutes, now', () => {
  const now = new Date('2026-09-02T00:00:00Z')
  assert.equal(formatCountdown(new Date('2026-09-05T14:30:00Z'), now), '3d 14h')
  assert.equal(formatCountdown(new Date('2026-09-02T05:20:00Z'), now), '5h 20m')
  assert.equal(formatCountdown(new Date('2026-09-02T00:12:00Z'), now), '12m')
  assert.equal(formatCountdown(new Date('2026-09-01T00:00:00Z'), now), 'now')
})

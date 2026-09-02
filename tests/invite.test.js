import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseInviteCode } from '../src/lib/invite.js'

test('parseInviteCode accepts codes and links', () => {
  assert.equal(parseInviteCode('orangebloods'), 'orangebloods')
  assert.equal(parseInviteCode('  CNHUOO '), 'CNHUOO')
  assert.equal(parseInviteCode('https://cfb-market.vercel.app/join/orangebloods'), 'orangebloods')
  assert.equal(parseInviteCode('cfb-market.vercel.app/join/orangebloods/'), 'orangebloods')
  assert.equal(parseInviteCode('https://cfb-market.vercel.app/join/orangebloods?utm=1#x'), 'orangebloods')
  assert.equal(parseInviteCode('https%3A%2F%2Fcfb-market.vercel.app%2Fjoin%2Forangebloods'), 'orangebloods')
  assert.equal(parseInviteCode(''), '')
  assert.equal(parseInviteCode(null), '')
})

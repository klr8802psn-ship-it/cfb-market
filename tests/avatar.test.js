import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avatarColor, initials } from '../src/lib/avatar.js'

test('initials: first + last word, uppercased', () => {
  assert.equal(initials('Kenny Rogers'), 'KR')
  assert.equal(initials('kenny'), 'K')
  assert.equal(initials('Tyler  J  Thompson'), 'TT')
  assert.equal(initials(''), '?')
  assert.equal(initials(null), '?')
})

test('avatarColor is deterministic and case-insensitive', () => {
  assert.equal(avatarColor('Kenny'), avatarColor('kenny '))
  assert.match(avatarColor('Kenny'), /^#[0-9A-F]{6}$/i)
  assert.equal(avatarColor(''), '#475569')
})

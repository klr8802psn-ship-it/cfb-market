// Deterministic avatar color + initials for a display name. Pure; tested in tests/avatar.test.js.

const PALETTE = ['#F59E0B', '#38D982', '#60A5FA', '#F472B6', '#A78BFA', '#FB923C', '#34D399', '#FBBF24', '#F87171', '#22D3EE']

export function avatarColor(name) {
  const s = (name ?? '').trim().toLowerCase()
  if (!s) return '#475569'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function initials(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

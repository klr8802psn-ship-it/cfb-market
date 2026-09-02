// Accepts a bare code ("orangebloods") or a pasted invite link
// ("https://cfb-market.vercel.app/join/orangebloods?x=1", even URL-encoded) and returns the code.
export function parseInviteCode(input) {
  let s = (input ?? '').trim()
  if (!s) return ''
  try { s = decodeURIComponent(s) } catch { /* keep as-is */ }
  const m = s.match(/\/join\/([^/?#\s]+)/i)
  if (m) s = m[1]
  return s.replace(/^[\s/]+|[\s/]+$/g, '')
}

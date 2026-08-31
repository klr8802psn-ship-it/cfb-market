/**
 * teamMark.js — pure, testable helpers for TeamMark component.
 * No DOM / JSX dependencies so these can run under node --test.
 */

// ---------------------------------------------------------------------------
// Internal: parse a #RRGGBB or #RGB hex string to [r, g, b] in [0–255]
// Returns null if the input is not a valid hex color.
// ---------------------------------------------------------------------------
function parseHex(hex) {
  if (!hex || typeof hex !== 'string') return null
  const h = hex.trim()
  if (h[0] !== '#') return null
  const raw = h.slice(1)
  if (raw.length === 3) {
    // #RGB → #RRGGBB
    const r = parseInt(raw[0] + raw[0], 16)
    const g = parseInt(raw[1] + raw[1], 16)
    const b = parseInt(raw[2] + raw[2], 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return [r, g, b]
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16)
    const g = parseInt(raw.slice(2, 4), 16)
    const b = parseInt(raw.slice(4, 6), 16)
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null
    return [r, g, b]
  }
  return null
}

// ---------------------------------------------------------------------------
// WCAG relative luminance for an sRGB channel value in [0, 255].
// https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
// ---------------------------------------------------------------------------
function channelLuminance(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance([r, g, b]) {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  )
}

/**
 * pickTextColor(hex) → '#ffffff' | '#0a0f1e'
 *
 * Returns a readable text color over the given background hex string using
 * WCAG relative luminance. Defaults to white for invalid/missing input.
 */
export function pickTextColor(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return '#ffffff'

  const lum = relativeLuminance(rgb)
  // WCAG contrast ratio against white (#FFF, L=1.0):
  //   (1.0 + 0.05) / (lum + 0.05)
  // WCAG contrast ratio against near-black (#0a0f1e, L≈0.002):
  //   (lum + 0.05) / (0.002 + 0.05)
  // Pick whichever gives a better contrast ratio (≥ 4.5 preferred).
  const WHITE = '#ffffff'
  const DARK = '#0a0f1e'

  const contrastAgainstWhite = (1.0 + 0.05) / (lum + 0.05)
  const contrastAgainstDark = (lum + 0.05) / (0.002 + 0.05)

  return contrastAgainstWhite >= contrastAgainstDark ? WHITE : DARK
}

/**
 * fitAbbr(abbr) → { text: string, long: boolean }
 *
 * Normalises and caps a team abbreviation for display inside TeamMark.
 *
 * - `text`  — uppercased, max 4 chars; falls back to '?' when empty/invalid.
 * - `long`  — true when the text is 4 chars (component should shrink the font).
 */
export function fitAbbr(abbr) {
  const FALLBACK = '?'
  if (!abbr || typeof abbr !== 'string') {
    return { text: FALLBACK, long: false }
  }
  const upper = abbr.trim().toUpperCase()
  if (!upper) return { text: FALLBACK, long: false }

  const text = upper.slice(0, 4)
  return { text, long: text.length >= 4 }
}

import { pickTextColor, fitAbbr } from '../lib/teamMark'

const NEUTRAL_BG = '#334155'
const DIMS = {
  xs: { tile: 16, font: 6, fontLong: 5 },
  sm: { tile: 20, font: 8, fontLong: 7 },
  md: { tile: 28, font: 11, fontLong: 9 },
  lg: { tile: 40, font: 15, fontLong: 12 },
  xl: { tile: 56, font: 20, fontLong: 16 },
}
const RADIUS = { xs: 3, sm: 4, md: 6, lg: 8, xl: 12 }

function sameColor(a, b) {
  if (!a || !b) return true
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

// Two-tone badge: primary fills the tile, secondary shows as a diagonal corner band — reads as a
// "logo" without using any trademarked artwork. Text contrast is computed against the primary.
export function TeamMark({ color, color2, abbr, size = 'md', logoUrl, className = '', title }) {
  const dims = DIMS[size] ?? DIMS.md
  const radius = RADIUS[size] ?? RADIUS.md
  const { text, long } = fitAbbr(abbr)
  const bg = color || NEUTRAL_BG
  const textColor = pickTextColor(bg)
  const fontSize = long ? dims.fontLong : dims.font
  const label = title ?? text
  const twoTone = !sameColor(bg, color2)

  const sharedStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: dims.tile, height: dims.tile, borderRadius: radius,
    flexShrink: 0, overflow: 'hidden', verticalAlign: 'middle', position: 'relative',
  }

  if (logoUrl) {
    return (
      <span className={`team-mark ${className}`} title={label} aria-label={label} style={sharedStyle}>
        <img src={logoUrl} alt={text} draggable={false}
          style={{ width: '90%', height: '90%', objectFit: 'contain', display: 'block' }} />
      </span>
    )
  }

  return (
    <span className={`team-mark ${className}`} title={label} aria-label={label} style={{
      ...sharedStyle,
      background: twoTone
        ? `linear-gradient(135deg, ${bg} 0%, ${bg} 68%, ${color2} 68%, ${color2} 100%)`
        : bg,
      color: textColor, fontSize,
      fontWeight: 800, fontFamily: 'inherit',
      letterSpacing: long ? '-0.03em' : '0.01em',
      textTransform: 'uppercase', userSelect: 'none',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      textShadow: textColor === '#ffffff' ? '0 1px 1px rgba(0,0,0,0.35)' : 'none',
    }}>
      {text}
    </span>
  )
}

export default TeamMark

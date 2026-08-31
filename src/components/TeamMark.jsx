import { pickTextColor, fitAbbr } from '../lib/teamMark'

const NEUTRAL_BG = '#334155'
const DIMS = {
  sm: { tile: 20, font: 8, fontLong: 7 },
  md: { tile: 28, font: 11, fontLong: 9 },
  lg: { tile: 40, font: 15, fontLong: 12 },
}
const RADIUS = { sm: 4, md: 6, lg: 8 }

export function TeamMark({ color, abbr, size = 'md', logoUrl, className = '', title }) {
  const dims = DIMS[size] ?? DIMS.md
  const radius = RADIUS[size] ?? RADIUS.md
  const { text, long } = fitAbbr(abbr)
  const bg = color || NEUTRAL_BG
  const textColor = pickTextColor(bg)
  const fontSize = long ? dims.fontLong : dims.font
  const label = title ?? text

  const sharedStyle = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: dims.tile, height: dims.tile, borderRadius: radius,
    flexShrink: 0, overflow: 'hidden', verticalAlign: 'middle',
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
      ...sharedStyle, background: bg, color: textColor, fontSize,
      fontWeight: 800, fontFamily: 'inherit',
      letterSpacing: long ? '-0.03em' : '0.01em',
      textTransform: 'uppercase', userSelect: 'none',
    }}>
      {text}
    </span>
  )
}

export default TeamMark

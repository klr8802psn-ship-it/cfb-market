import { formatCountdown, formatWeekdayTime } from '../lib/schedule'

function fmtPrice(n) { return '$' + Number(n).toFixed(2) }
function fmtPct(n) {
  const v = Number(n) || 0
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%'
}

// tickerItems: [{ team, price, pct }] — pct may be null before the second settle.
export function Ticker({ items, onSelect, label }) {
  if (!items?.length) return null
  const loop = [...items, ...items]   // duplicated so the -50% translate loops seamlessly
  const dur = Math.max(30, items.length * 3.2)
  return (
    <div className="ticker" aria-label={label} style={{ '--ticker-dur': `${dur}s` }}>
      <div className="ticker__track">
        {loop.map((it, i) => {
          const tone = it.pct == null ? 'var(--faint)' : it.pct > 0 ? 'var(--positive)' : it.pct < 0 ? 'var(--negative)' : 'var(--faint)'
          return (
            <button key={`${it.team.id}-${i}`} type="button" className="ticker__item" onClick={() => onSelect?.(it.team)} tabIndex={i >= items.length ? -1 : 0} aria-hidden={i >= items.length}>
              <span className="ticker__sym">{it.team.abbreviation}</span>
              <span>{fmtPrice(it.price)}</span>
              {it.pct != null && it.pct !== 0 && (
                <span style={{ color: tone, fontWeight: 700 }}>{it.pct > 0 ? '▲' : '▼'} {fmtPct(Math.abs(it.pct))}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function AppBar({ leagueName, tradingOpen, closeAt, openAt, now, tickerItems, tickerLabel, onTickerSelect }) {
  return (
    <header className="appbar">
      <div className="appbar__inner">
        <div className="wordmark">
          <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden style={{ flexShrink: 0 }}>
            <rect width="64" height="64" rx="14" fill="#1E2C24" />
            <polyline points="10,46 22,36 30,40 42,24 54,16" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="42,16 54,16 54,28" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span>CFB Market</span>
            {leagueName && <span className="wordmark__league">{leagueName}</span>}
          </div>
        </div>
        {tradingOpen ? (
          <span className="status-pill status-pill--open" title={`Trading closes ${formatWeekdayTime(closeAt)}`}>
            <span className="status-pill__dot" />
            OPEN · {formatCountdown(closeAt, now)}
          </span>
        ) : (
          <span className="status-pill status-pill--closed" title={`Trading reopens ${formatWeekdayTime(openAt)}`}>
            <span className="status-pill__dot" />
            CLOSED · {formatCountdown(openAt, now)}
          </span>
        )}
      </div>
      <Ticker items={tickerItems} label={tickerLabel} onSelect={onTickerSelect} />
    </header>
  )
}

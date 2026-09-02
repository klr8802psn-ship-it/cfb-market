import { useEffect, useRef, useState } from 'react'
import TeamMark from './TeamMark'
import { validateBuy } from '../lib/stocks'
import { positionPL } from '../lib/costBasis'

function fmt(n) {
  return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPrice(n) { return n == null ? '—' : '$' + Number(n).toFixed(2) }
function fmtSigned(n) { const v = Number(n) || 0; return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) }
function fmtSignedMoney(n) {
  const v = Number(n) || 0
  return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n) { const v = Number(n) || 0; return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%' }
function tone(v) { return v > 0 ? 'var(--positive)' : v < 0 ? 'var(--negative)' : 'var(--muted)' }
function fmtDate(iso) { return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '' }

function Chart({ history }) {
  const vals = history.map(p => Number(p.price))
  if (vals.length < 2) {
    return (
      <div style={{ padding: '22px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Price history starts after the next Monday settle.</p>
      </div>
    )
  }
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1
  const W = 320, H = 120, PAD = { t: 12, b: 26, l: 6, r: 6 }
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b, n = vals.length
  const pts = vals.map((v, i) => ({ x: PAD.l + (i / (n - 1)) * cw, y: PAD.t + ch - ((v - min) / range) * ch, date: history[i].date }))
  const line = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const up = vals[n - 1] >= vals[0]
  const color = up ? 'var(--positive)' : 'var(--negative)'
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sheetFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ch * f} y2={PAD.t + ch * f} stroke="rgba(255,255,255,0.05)" />)}
      <polygon points={`${pts[0].x},${PAD.t + ch} ${line} ${pts[n - 1].x},${PAD.t + ch}`} fill="url(#sheetFill)" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={i === n - 1 ? 4 : 3} fill={i === n - 1 ? color : 'var(--surface)'} stroke={color} strokeWidth="1.5" />)}
      <text x={pts[0].x} y={H - 6} fontSize="9" fill="var(--faint)" fontFamily="var(--font-mono)">{fmtDate(pts[0].date)}</text>
      <text x={pts[n - 1].x} y={H - 6} textAnchor="end" fontSize="9" fill="var(--faint)" fontFamily="var(--font-mono)">{fmtDate(pts[n - 1].date)}</text>
      <text x={W - PAD.r} y={PAD.t - 2} textAnchor="end" fontSize="9" fill="var(--faint)" fontFamily="var(--font-mono)">H {fmtPrice(max)} · L {fmtPrice(min)}</text>
    </svg>
  )
}

let openSheets = 0   // module-level: how many TeamSheets are mounted (see history handling below)

function Stat({ label, value, sub, color }) {
  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', margin: '0 0 3px' }}>{label}</p>
      <p className="num" style={{ fontSize: 15, fontWeight: 900, color: color ?? '#fff', margin: 0 }}>{value}</p>
      {sub && <p className="num" style={{ fontSize: 10, color: 'var(--faint)', margin: 0 }}>{sub}</p>}
    </div>
  )
}

export default function TeamSheet({ team, rank, price, prevPrice, fpi, history, held, basis, cash, holdings, priceByTeam, tradingOpen, onBuy, onSell, onClose }) {
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // Dismissal: ✕ button, grip tap, backdrop tap, Escape, swipe-down, and the phone's back button.
  useEffect(() => {
    let closedByPop = false
    const onPop = () => { closedByPop = true; onCloseRef.current() }
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current() }
    openSheets++
    if (!window.history.state?.teamSheet) window.history.pushState({ teamSheet: true }, '')
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      openSheets--
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      // Closed via UI: pop the history entry we pushed so Back doesn't need two taps.
      // Deferred + counted so StrictMode's mount/unmount/mount in dev doesn't fire a stray back().
      setTimeout(() => {
        if (openSheets === 0 && !closedByPop && window.history.state?.teamSheet) window.history.back()
      }, 0)
    }
  }, [])

  const sheetRef = useRef(null)
  const touchStartY = useRef(null)
  const [dragY, setDragY] = useState(0)
  function onTouchStart(e) {
    if (sheetRef.current && sheetRef.current.scrollTop > 0) { touchStartY.current = null; return }
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchMove(e) {
    if (touchStartY.current == null) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) setDragY(dy)
  }
  function onTouchEnd() {
    if (touchStartY.current == null) return
    const dy = dragY
    touchStartY.current = null
    setDragY(0)
    if (dy > 90) onCloseRef.current()
  }

  const hasPrice = price != null
  const delta = hasPrice && prevPrice != null ? price - prevPrice : null
  const pct = delta != null && prevPrice ? (delta / prevPrice) * 100 : null
  const pl = held > 0 && hasPrice && basis ? positionPL({ shares: held, avgCost: basis.avgCost, price }) : null
  const buyCheck = hasPrice ? validateBuy({ cash, holdings, priceByTeam, teamId: team.id, shares: 1 }) : { ok: false, reason: 'not priced yet' }
  const canBuy = tradingOpen && buyCheck.ok
  const canSell = tradingOpen && held > 0
  const buyHint = !tradingOpen ? 'Market closed' : !hasPrice ? 'Not priced yet' : !buyCheck.ok ? (buyCheck.reason.includes('cash') ? 'Not enough cash' : 'At 40% cap') : null

  return (
    <div className="sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${team.name} details`}>
      <div
        className="sheet"
        ref={sheetRef}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <button type="button" className="sheet__grip-btn" onClick={onClose} aria-label="Close">
          <span className="sheet__grip" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className="sheet__close">✕</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingRight: 40 }}>
          <TeamMark color={team.primary_color} color2={team.secondary_color} abbr={team.abbreviation} size="xl" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {rank && <span className={`rank ${rank <= 25 ? 'rank--top' : ''}`} style={{ fontSize: 12 }}>#{rank}</span>}
              <p className="ellip" style={{ fontFamily: 'var(--font-display)', fontWeight: 900, color: '#fff', fontSize: 18, margin: 0, letterSpacing: '-0.01em' }}>{team.name}</p>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0', fontWeight: 600 }}>
              {team.conference}{fpi != null ? <span className="num" style={{ color: 'var(--faint)' }}> · FPI {Number(fpi) > 0 ? '+' : ''}{Number(fpi).toFixed(1)}</span> : null}
            </p>
          </div>
          <div className="text-right" style={{ flexShrink: 0 }}>
            <p className="num" style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1 }}>{fmtPrice(price)}</p>
            {delta != null && (
              <p className="num" style={{ fontSize: 11, fontWeight: 900, color: tone(delta), margin: '3px 0 0' }}>{fmtSigned(delta)} ({fmtPct(pct)})</p>
            )}
            {delta == null && hasPrice && <p className="num" style={{ fontSize: 10, color: 'var(--faint)', margin: '3px 0 0' }}>first settle</p>}
          </div>
        </div>

        <div className="card" style={{ padding: '10px 10px 4px', marginBottom: 14, background: 'var(--bg-2)' }}>
          <Chart history={history} />
        </div>

        {held > 0 ? (
          <div className="card" style={{ padding: 14, marginBottom: 14, borderColor: 'var(--accent-line)', background: 'rgba(245,158,11,0.04)' }}>
            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', margin: '0 0 10px' }}>Your position</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <Stat label="Shares" value={held} sub={basis ? `avg ${fmtPrice(basis.avgCost)}` : null} />
              <Stat label="Value" value={fmt(pl?.value ?? held * (price ?? 0))} />
              <Stat label="Gain / loss" value={pl ? fmtSignedMoney(pl.pl) : '—'} sub={pl ? fmtPct(pl.plPct) : null} color={pl ? tone(pl.pl) : undefined} />
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--faint)', margin: '0 0 14px', textAlign: 'center' }}>You don't own any {team.abbreviation} yet.</p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn" disabled={!canSell} onClick={() => onSell(team)}
            style={{ flex: 1, background: canSell ? 'var(--negative-soft)' : 'rgba(255,255,255,0.04)', color: canSell ? 'var(--negative)' : '#475569', border: `1px solid ${canSell ? 'rgba(255,107,122,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
            Sell
          </button>
          <button type="button" className="btn" disabled={!canBuy} onClick={() => onBuy(team)}
            style={{ flex: 1.4, background: canBuy ? 'var(--positive)' : 'rgba(255,255,255,0.04)', color: canBuy ? '#04150c' : '#475569', border: `1px solid ${canBuy ? 'var(--positive)' : 'rgba(255,255,255,0.06)'}` }}>
            {buyHint ?? `Buy ${team.abbreviation}`}
          </button>
        </div>
        <button type="button" onClick={onClose} className="sheet__back">← Back to market</button>
      </div>
    </div>
  )
}

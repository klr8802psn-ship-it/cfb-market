import { useState, useMemo } from 'react'
import { validateBuy, validateSell, portfolioValue, maxBuyShares, POSITION_CAP } from '../lib/stocks'

function fmt(n) {
  return '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPrice(n) {
  if (n == null) return '—'
  return '$' + Number(n).toFixed(2)
}

export default function TradeModal({ team, side, cash, holdings, priceByTeam, onConfirm, onCancel, busy, error }) {
  const [shares, setShares] = useState(1)
  const price = priceByTeam[team.id] ?? 0
  const held = holdings.find(h => h.team_id === team.id)?.shares ?? 0
  const portfolio = portfolioValue({ cash, holdings, priceByTeam })

  const validation = useMemo(() => {
    if (side === 'buy') return validateBuy({ cash, holdings, priceByTeam, teamId: team.id, shares })
    return validateSell({ holdings, teamId: team.id, shares })
  }, [side, cash, holdings, priceByTeam, team.id, shares])

  const maxShares = side === 'buy' ? maxBuyShares({ cash, holdings, priceByTeam, teamId: team.id }) : held
  const maxPositionAmount = portfolio * POSITION_CAP

  function setClamped(n) {
    setShares(Math.max(1, Math.min(maxShares || 1, Math.floor(n))))
  }
  function adjust(delta) { setClamped(shares + delta) }

  const cost = shares * price
  const canConfirm = validation.ok && !busy

  // Allocation after this trade
  const heldAfter = side === 'buy' ? held + shares : Math.max(0, held - shares)
  const allocAfter = portfolio > 0 ? (heldAfter * price) / portfolio * 100 : 0
  const allocNow = portfolio > 0 ? (held * price) / portfolio * 100 : 0
  const allocColor = allocAfter > POSITION_CAP * 100 + 1e-6 ? 'var(--negative)' : allocAfter > 30 ? 'var(--accent)' : 'var(--positive)'

  const quick = side === 'buy'
    ? [
        { label: '25%', n: Math.floor(maxShares * 0.25) },
        { label: '50%', n: Math.floor(maxShares * 0.5) },
        { label: 'Max', n: maxShares },
      ]
    : [
        { label: '25%', n: Math.floor(held * 0.25) },
        { label: '50%', n: Math.floor(held * 0.5) },
        { label: 'All', n: held },
      ]

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.72)' }}>
      <div className="card card--raised" style={{ width: '100%', maxWidth: 360, padding: 20, borderRadius: 18, maxHeight: '85dvh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, color: '#fff', fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</p>
            <p style={{ fontSize: 12, color: 'var(--faint)', fontFamily: 'var(--font-mono)', margin: 0 }}>
              {fmtPrice(price)} / share{held > 0 ? ` · you hold ${held}` : ''}
            </p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px', borderRadius: 6, background: side === 'buy' ? 'var(--positive-soft)' : 'var(--negative-soft)', color: side === 'buy' ? 'var(--positive)' : 'var(--negative)' }}>
            {side === 'buy' ? 'Buy' : 'Sell'}
          </span>
        </div>

        {/* Share stepper */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', margin: 0 }}>Shares</p>
            <p style={{ fontSize: 11, color: 'var(--faint)', margin: 0, fontFamily: 'var(--font-mono)' }}>
              {side === 'buy' ? `max ${maxShares}` : `${held} held`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => adjust(-1)} disabled={shares <= 1} aria-label="One fewer share"
              style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: shares <= 1 ? '#475569' : '#fff', cursor: shares <= 1 ? 'not-allowed' : 'pointer' }}>
              −
            </button>
            <input type="number" inputMode="numeric" min={1} max={maxShares || 1} value={shares} aria-label="Shares"
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setClamped(v) }}
              style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 22, color: '#fff', background: 'transparent', border: 'none', outline: 'none' }} />
            <button onClick={() => adjust(1)} disabled={shares >= maxShares} aria-label="One more share"
              style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: shares >= maxShares ? '#475569' : '#fff', cursor: shares >= maxShares ? 'not-allowed' : 'pointer' }}>
              +
            </button>
          </div>
        </div>

        {/* Quick amounts */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {quick.map(q => {
            const disabled = q.n < 1
            const active = !disabled && shares === q.n
            return (
              <button key={q.label} type="button" disabled={disabled} onClick={() => setClamped(q.n)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 800, fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
                  background: active ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                  color: active ? '#160D02' : disabled ? '#475569' : 'var(--muted)',
                  border: `1px solid ${active ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`, transition: 'all 0.15s',
                }}>
                {q.label}{!disabled && <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>{q.n}</span>}
              </button>
            )
          })}
        </div>

        {/* Cost summary */}
        <div style={{ borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12, padding: '4px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{side === 'buy' ? 'Total cost' : 'Proceeds'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 14, color: '#fff' }}>{fmt(cost)}</span>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Cash after</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fff' }}>{fmt(side === 'buy' ? cash - cost : cash + cost)}</span>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{team.abbreviation ?? 'Team'} share of portfolio</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: allocColor, fontWeight: 900 }}>
              {allocNow.toFixed(0)}% → {allocAfter.toFixed(0)}%
              <span style={{ color: 'var(--faint)', fontWeight: 400 }}> / {Math.round(POSITION_CAP * 100)}% cap</span>
            </span>
          </div>
        </div>

        {side === 'buy' && maxShares === 0 && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            {cash < price ? `You need ${fmt(price)} in cash to buy one share.` : `You're at the ${Math.round(POSITION_CAP * 100)}% cap for this team (${fmt(maxPositionAmount)} max).`}
          </p>
        )}

        {/* Client-side validation error */}
        {!validation.ok && shares > 0 && maxShares > 0 && (
          <div style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: 'var(--negative-soft)', color: 'var(--negative)', border: '1px solid rgba(255,107,122,0.2)', marginBottom: 12 }}>
            {validation.reason}
          </div>
        )}

        {/* Server error (trading locked, etc.) */}
        {error && (
          <div style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: 'var(--negative-soft)', color: 'var(--negative)', border: '1px solid rgba(255,107,122,0.22)', marginBottom: 12, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 14, color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(shares)} disabled={!canConfirm}
            style={{ flex: 1, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 14, border: 'none', cursor: canConfirm ? 'pointer' : 'not-allowed', background: canConfirm ? (side === 'buy' ? 'var(--positive)' : 'var(--negative)') : 'rgba(255,255,255,0.06)', color: canConfirm ? '#000' : '#475569', transition: 'all 0.15s', fontFamily: 'inherit' }}>
            {busy ? 'Processing…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${shares} share${shares !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

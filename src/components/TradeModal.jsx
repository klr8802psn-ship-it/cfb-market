import { useState, useMemo } from 'react'
import { validateBuy, validateSell } from '../lib/stocks'

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

  const validation = useMemo(() => {
    if (side === 'buy') return validateBuy({ cash, holdings, priceByTeam, teamId: team.id, shares })
    return validateSell({ holdings, teamId: team.id, shares })
  }, [side, cash, holdings, priceByTeam, team.id, shares])

  const held = holdings.find(h => h.team_id === team.id)?.shares ?? 0
  const maxBuy = price > 0 ? Math.floor(cash / price) : 0
  const maxSell = held
  const maxShares = side === 'buy' ? maxBuy : maxSell

  function adjust(delta) {
    setShares(prev => Math.max(1, Math.min(maxShares || 1, prev + delta)))
  }

  const cost = shares * price
  const canConfirm = validation.ok && !busy

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.72)' }}>
      <div className="card card--raised" style={{ width: '100%', maxWidth: 360, padding: 20, borderRadius: 18, maxHeight: '85dvh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, color: '#fff', fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</p>
            <p style={{ fontSize: 12, color: 'var(--faint)', fontFamily: 'var(--font-mono)', margin: 0 }}>{fmtPrice(price)} / share</p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px', borderRadius: 6, background: side === 'buy' ? 'rgba(56,217,130,0.12)' : 'rgba(255,107,122,0.12)', color: side === 'buy' ? '#38D982' : '#ff4466' }}>
            {side === 'buy' ? 'Buy' : 'Sell'}
          </span>
        </div>

        {/* Share stepper */}
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', marginBottom: 8 }}>Shares</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => adjust(-1)} disabled={shares <= 1}
              style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: shares <= 1 ? '#475569' : '#fff', cursor: shares <= 1 ? 'not-allowed' : 'pointer' }}>
              −
            </button>
            <input type="number" min={1} max={maxShares || 1} value={shares}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setShares(Math.min(maxShares || 1, v)) }}
              style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 22, color: '#fff', background: 'transparent', border: 'none', outline: 'none' }} />
            <button onClick={() => adjust(1)} disabled={shares >= maxShares}
              style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: shares >= maxShares ? '#475569' : '#fff', cursor: shares >= maxShares ? 'not-allowed' : 'pointer' }}>
              +
            </button>
          </div>
        </div>

        {/* Cost summary */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{side === 'buy' ? 'Total cost' : 'Proceeds'}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: 14, color: '#fff' }}>{fmt(cost)}</span>
        </div>
        {side === 'sell' && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>You hold {held} share{held !== 1 ? 's' : ''}</p>}
        {side === 'buy' && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Cash after: {fmt(cash - cost)}</p>}

        {/* Client-side validation error */}
        {!validation.ok && shares > 0 && (
          <div style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: 'rgba(255,107,122,0.08)', color: '#ff6b7a', border: '1px solid rgba(255,107,122,0.2)', marginBottom: 12 }}>
            {validation.reason}
          </div>
        )}

        {/* Server error (trading locked, etc.) */}
        {error && (
          <div style={{ fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 'var(--r-sm)', background: 'rgba(255,107,122,0.10)', color: '#ff6b7a', border: '1px solid rgba(255,107,122,0.22)', marginBottom: 12, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 14, color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(shares)} disabled={!canConfirm}
            style={{ flex: 1, padding: 12, borderRadius: 12, fontWeight: 900, fontSize: 14, border: 'none', cursor: canConfirm ? 'pointer' : 'not-allowed', background: canConfirm ? (side === 'buy' ? '#38D982' : '#ff4466') : 'rgba(255,255,255,0.06)', color: canConfirm ? '#000' : '#475569', transition: 'all 0.15s' }}>
            {busy ? 'Processing…' : `Confirm ${side === 'buy' ? 'Buy' : 'Sell'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

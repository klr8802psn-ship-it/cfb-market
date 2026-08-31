function fmt(n) {
  const v = Number(n) || 0
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PortfolioBar({ cash, holdingsVal, startCash }) {
  const total = cash + holdingsVal
  const pl = total - startCash
  const plPos = pl > 0
  const plNeg = pl < 0

  return (
    <div className="card card--raised" style={{ padding: 20, marginBottom: 20 }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 16 }}>
        My Portfolio
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', marginBottom: 4 }}>Cash</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 900, color: '#fff' }}>{fmt(cash)}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', marginBottom: 4 }}>Holdings</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 900, color: '#fff' }}>{fmt(holdingsVal)}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', marginBottom: 4 }}>Total</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 900, color: '#fff' }}>{fmt(total)}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', marginBottom: 4 }}>vs Start</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 900, color: plPos ? 'var(--positive)' : plNeg ? 'var(--negative)' : 'var(--muted)' }}>
            {plPos ? '+' : ''}{fmt(pl)}
          </p>
        </div>
      </div>
    </div>
  )
}

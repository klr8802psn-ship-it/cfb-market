import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="landing-container">
      <div className="landing-grid">
      <div className="landing-hero">
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>
          CFB Season 2026
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 40, lineHeight: 1.05, color: '#fff', marginBottom: 16 }}>
          CFB Market
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
          Trade FBS team stocks. Prices move with ESPN FPI and SP+ power rankings.
          The biggest portfolio at season end wins.
        </p>
        <Link to="/login" className="btn btn--accent" style={{ width: '100%', display: 'block', textAlign: 'center', marginBottom: 12 }}>
          Get Started
        </Link>
      </div>

      <div className="landing-how card">
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 20 }}>
          How it works
        </p>
        {[
          ['Play money only', 'No real cash — just bragging rights. Everyone starts with the same bankroll.'],
          ['Prices follow the rankings', 'Teams that win and climb the ESPN FPI and SP+ power rankings go up in value.'],
          ['Weekly settle', 'Prices update each Monday after the weekend games.'],
          ['40% cap per team', "Can't put more than 40% of your portfolio in one team."],
          ['Best portfolio wins', 'Final standings at season end determine the champion.'],
        ].map(([title, desc]) => (
          <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <span style={{ color: 'var(--faint)', marginTop: 2, flexShrink: 0 }}>›</span>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
              <span style={{ color: '#fff', fontWeight: 700 }}>{title} — </span>{desc}
            </p>
          </div>
        ))}
      </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', paddingTop: 24, paddingBottom: 32 }}>
        CFB Market uses virtual play money. No real money is wagered or won.
      </p>
    </div>
  )
}

import { useState } from 'react'
import TeamMark from './TeamMark'
import { recapShareText } from '../lib/recap'

function fmtSignedMoney(n) {
  const v = Number(n) || 0
  return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n) {
  const v = Number(n) || 0
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%'
}
function toneColor(v) {
  return v > 0 ? 'var(--positive)' : v < 0 ? 'var(--negative)' : 'var(--muted)'
}

// Web Share sheet on phones, clipboard everywhere else. Returns true if the text was handed off.
async function shareOrCopy(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return true }
    catch (err) { if (err?.name === 'AbortError') return false }
  }
  try { await navigator.clipboard.writeText(text); return 'copied' }
  catch { return false }
}

function MoveTile({ label, move, team }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 'var(--r-sm)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)' }}>
      <p style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--faint)', margin: '0 0 5px' }}>{label}</p>
      {move && team ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <TeamMark color={team.primary_color} color2={team.secondary_color} abbr={team.abbreviation} size="xs" />
          <span className="ellip" style={{ fontSize: 12, fontWeight: 700, color: '#fff', minWidth: 0 }}>{team.abbreviation ?? team.name}</span>
          <span className="num" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 900, color: toneColor(move.change) }}>{fmtSignedMoney(move.change)}</span>
        </span>
      ) : (
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>—</span>
      )}
    </div>
  )
}

export default function WeeklyRecap({ recap, settledLabel, leagueName, inviteLink, teamsById, currentUserId, onDismiss }) {
  const [status, setStatus] = useState(null)  // null | 'copied-share' | 'copied-invite'

  async function handleShare() {
    const res = await shareOrCopy(recapShareText({ recap, leagueName, url: inviteLink }))
    if (res === 'copied') setStatus('copied-share')
  }
  async function handleInvite() {
    const res = await shareOrCopy(`Join my CFB Market league, ${leagueName}. Buy and sell college football teams like stocks: ${inviteLink}`)
    if (res === 'copied') setStatus('copied-invite')
  }

  const move = recap.prevRank - recap.rank  // positive = climbed
  const isLeader = recap.leagueBest?.user_id === currentUserId

  return (
    <section className="card card--raised" aria-label="Week in review" style={{ padding: 16, marginBottom: 16, borderColor: 'rgba(245,158,11,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--accent)', textTransform: 'uppercase', margin: 0 }}>
          Week in review{settledLabel ? ` · ${settledLabel}` : ''}
        </p>
        <button type="button" onClick={onDismiss} aria-label="Dismiss weekly recap" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>✕</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <p className="num" style={{ fontSize: 24, fontWeight: 900, color: toneColor(recap.weekChange), margin: 0 }}>
          {fmtSignedMoney(recap.weekChange)} <span style={{ fontSize: 13 }}>({fmtPct(recap.weekPct)})</span>
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, whiteSpace: 'nowrap' }}>
          <span style={{ color: '#fff', fontWeight: 900 }}>#{recap.rank}</span> of {recap.count}
          {move !== 0 && (
            <span className="num" style={{ marginLeft: 6, fontWeight: 900, color: move > 0 ? 'var(--positive)' : 'var(--negative)' }}>{move > 0 ? '▲' : '▼'}{Math.abs(move)}</span>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <MoveTile label="Best position" move={recap.best} team={recap.best && teamsById[recap.best.team_id]} />
        <MoveTile label="Worst position" move={recap.worst} team={recap.worst && teamsById[recap.worst.team_id]} />
      </div>

      {recap.leagueBest && (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>
          {isLeader
            ? <>🔥 <span style={{ color: '#fff', fontWeight: 800 }}>You</span> had the biggest week in the league.</>
            : <>Biggest week in the league: <span style={{ color: '#fff', fontWeight: 800 }}>{recap.leagueBest.display_name ?? 'Someone'}</span> <span className="num" style={{ color: 'var(--positive)', fontWeight: 900 }}>{fmtSignedMoney(recap.leagueBest.weekChange)}</span></>}
        </p>
      )}

      <button type="button" className="btn btn--accent" onClick={handleShare} style={{ width: '100%', padding: '10px 16px' }}>
        {status === 'copied-share' ? 'Copied! Paste it in the group chat' : 'Share my week'}
      </button>

      <p style={{ fontSize: 12, color: 'var(--faint)', textAlign: 'center', margin: '12px 0 0' }}>
        More rivals, more bragging rights.{' '}
        <button type="button" onClick={handleInvite} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', fontWeight: 800, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
          {status === 'copied-invite' ? 'Invite link copied ✓' : 'Invite your friends →'}
        </button>
      </p>
    </section>
  )
}

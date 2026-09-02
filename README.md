# CFB Market

Play-money stock market for FBS college football teams. Players in a league buy and sell shares of teams; prices are derived from ESPN FPI and SP+ ratings and settle every Monday. Biggest portfolio at the end of the season wins.

- **Live:** https://cfb-market.vercel.app
- **Stack:** Vite + React 19, React Router, Supabase (shared project with 4th and Long), Vercel
- **Price engine:** `stock-settle` Supabase edge function (source lives in the 4th and Long repo under `supabase/functions/stock-settle/`)

## Develop

```bash
npm install
cp .env.example .env      # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev
npm test                  # node:test suites for src/lib
npm run lint
```

## Deploy

```bash
npx vercel --prod --yes
```

## Schedule (pg_cron, UTC)

| Job | Schedule | Effect |
|-----|----------|--------|
| `stock-market-close-thursday` | `0 23 * * 4` | `trading_open = false` for every enabled league |
| `stock-market-settle-monday` | `0 10 * * 1` | Pull FPI + SP+, write new prices, reopen trading |
| `stock-market-settle-monday-catchup` | `0 15 * * 1` | Re-settle same week with fresher SP+ |

`src/lib/schedule.js` mirrors these times for the in-app countdowns. Change both together.

## Key files

- `src/pages/Market.jsx` — trading, My Stocks (cost basis P/L), league leaderboard + activity
- `src/pages/Leaderboard.jsx` — public leaderboard (`/leaderboard?league=<invite_code>`)
- `src/pages/Admin.jsx`, `src/pages/AdminLeague.jsx` — platform-admin tools
- `src/lib/stocks.js` — client-side trade validation (server enforces via `stock_trade` RPC)
- `src/lib/costBasis.js`, `src/lib/schedule.js` — pure helpers with tests in `tests/`

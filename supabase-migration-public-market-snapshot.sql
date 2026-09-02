-- Public market snapshot for the landing page (anon-callable).
-- Returns the latest + previous settle price for the top N teams in the most recent PUBLIC league.
-- No user data is exposed — prices only. Applied to project tdpxgddrgbianarsahro on 2026-09-02.

CREATE OR REPLACE FUNCTION public.get_public_market_snapshot(p_limit integer DEFAULT 10)
RETURNS TABLE (
  team_id uuid,
  name text,
  abbreviation text,
  primary_color text,
  secondary_color text,
  conference text,
  price numeric,
  prev_price numeric,
  settled_at timestamptz,
  league_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lg AS (
    SELECT sc.season_id, l.name AS league_name
    FROM public.stock_config sc
    JOIN public.leagues l ON l.id = sc.league_id
    WHERE sc.enabled = true
      AND coalesce(sc.is_public, false) = true
    ORDER BY sc.created_at DESC
    LIMIT 1
  ),
  ranked AS (
    SELECT sp.team_id, sp.price, sp.settled_at,
           row_number() OVER (PARTITION BY sp.team_id ORDER BY sp.settled_at DESC) AS rn
    FROM public.stock_prices sp
    JOIN lg ON lg.season_id = sp.season_id
  ),
  latest AS (SELECT r.team_id, r.price, r.settled_at FROM ranked r WHERE r.rn = 1),
  prev   AS (SELECT r.team_id, r.price AS prev_price FROM ranked r WHERE r.rn = 2)
  SELECT t.id, t.name, t.abbreviation, t.primary_color, t.secondary_color, t.conference,
         latest.price, prev.prev_price, latest.settled_at, lg.league_name
  FROM latest
  JOIN public.teams t ON t.id = latest.team_id
  LEFT JOIN prev ON prev.team_id = latest.team_id
  CROSS JOIN lg
  ORDER BY latest.price DESC, t.name
  LIMIT greatest(1, least(coalesce(p_limit, 10), 50));
$$;

REVOKE ALL ON FUNCTION public.get_public_market_snapshot(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_market_snapshot(integer) TO anon, authenticated;

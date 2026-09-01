-- Harden CFB Market launch controls.
-- Applied to Supabase project tdpxgddrgbianarsahro on 2026-09-01.

DROP POLICY IF EXISTS "users: update own profile" ON public.users;

REVOKE UPDATE ON public.users FROM anon, authenticated;
REVOKE INSERT (is_admin_platform) ON public.users FROM anon, authenticated;

GRANT UPDATE (display_name, ob_handle, avatar_url, favorite_team, email_reminders_enabled, onboarding_complete)
  ON public.users TO authenticated;

CREATE POLICY "users: update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK (
    (select auth.uid()) = id
    AND is_admin_platform = (
      SELECT u.is_admin_platform
      FROM public.users u
      WHERE u.id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "stock_accounts: member manages own account" ON public.stock_accounts;
DROP POLICY IF EXISTS "stock_holdings: member manages own holdings" ON public.stock_holdings;
DROP POLICY IF EXISTS "stock_transactions: member inserts own trades" ON public.stock_transactions;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stock_accounts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stock_holdings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stock_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stock_prices FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.stock_trade(uuid, uuid, uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_league_by_invite_code(text) FROM anon;

CREATE OR REPLACE FUNCTION public.join_stock_league_by_invite_code(p_code text)
RETURNS TABLE(league_id uuid, league_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league_id uuid;
  v_league_name text;
  v_season_id uuid;
  v_start_cash integer;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT l.id, l.name, sc.season_id, sc.start_cash
    INTO v_league_id, v_league_name, v_season_id, v_start_cash
  FROM public.leagues l
  JOIN public.stock_config sc ON sc.league_id = l.id
  WHERE lower(l.invite_code) = lower(trim(p_code))
    AND coalesce(l.is_active, true) = true
    AND sc.enabled = true
  ORDER BY sc.created_at DESC
  LIMIT 1;

  IF v_league_id IS NULL OR v_season_id IS NULL THEN
    RAISE EXCEPTION 'invalid_invite_code';
  END IF;

  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (v_league_id, v_uid, 'member')
  ON CONFLICT (league_id, user_id) DO NOTHING;

  INSERT INTO public.stock_accounts (league_id, season_id, user_id, cash)
  VALUES (v_league_id, v_season_id, v_uid, coalesce(v_start_cash, 2000))
  ON CONFLICT (league_id, season_id, user_id) DO NOTHING;

  RETURN QUERY SELECT v_league_id, v_league_name;
END;
$$;

REVOKE ALL ON FUNCTION public.join_stock_league_by_invite_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_stock_league_by_invite_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_stock_leaderboard(p_league_id uuid)
RETURNS TABLE(user_id uuid, display_name text, ob_handle text, cash numeric, holdings_value numeric, total_value numeric, rank bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  SELECT sc.season_id INTO v_season_id
  FROM public.stock_config sc
  WHERE sc.league_id = p_league_id
    AND sc.enabled = true
    AND (
      coalesce(sc.is_public, false) = true
      OR EXISTS (
        SELECT 1 FROM public.league_members lm
        WHERE lm.league_id = p_league_id
          AND lm.user_id = v_uid
      )
    )
  ORDER BY sc.created_at DESC
  LIMIT 1;

  IF v_season_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH latest_prices AS (
    SELECT DISTINCT ON (sp.team_id) sp.team_id, sp.price
    FROM public.stock_prices sp
    WHERE sp.season_id = v_season_id
    ORDER BY sp.team_id, sp.settled_at DESC
  ),
  member_holdings AS (
    SELECT sh.user_id,
           COALESCE(SUM(sh.shares::numeric * COALESCE(lp.price, 0)::numeric), 0) AS holdings_val
    FROM public.stock_holdings sh
    LEFT JOIN latest_prices lp ON lp.team_id = sh.team_id
    WHERE sh.season_id = v_season_id
      AND sh.league_id = p_league_id
    GROUP BY sh.user_id
  )
  SELECT
    sa.user_id,
    COALESCE(u.display_name, split_part(au.email, '@', 1)) AS display_name,
    u.ob_handle,
    sa.cash::numeric,
    COALESCE(mh.holdings_val, 0) AS holdings_value,
    (sa.cash::numeric + COALESCE(mh.holdings_val, 0)) AS total_value,
    RANK() OVER (ORDER BY (sa.cash::numeric + COALESCE(mh.holdings_val, 0)) DESC) AS rank
  FROM public.stock_accounts sa
  JOIN public.users u ON u.id = sa.user_id
  JOIN auth.users au ON au.id = sa.user_id
  LEFT JOIN member_holdings mh ON mh.user_id = sa.user_id
  WHERE sa.season_id = v_season_id
    AND sa.league_id = p_league_id
  ORDER BY total_value DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_stock_leaderboard(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stock_leaderboard(uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.stock_trade(uuid, uuid, uuid, text, integer) TO authenticated;

-- Follow-up grant tightening: functions get EXECUTE for explicit roles only.
REVOKE ALL ON FUNCTION public.stock_trade(uuid, uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_trade(uuid, uuid, uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.join_stock_league_by_invite_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_stock_league_by_invite_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.join_league_by_invite_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_league_by_invite_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_public_stock_leagues() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_stock_leagues() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_stock_leaderboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_leaderboard(uuid) TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.users FROM anon, authenticated;
GRANT INSERT (id, display_name, ob_handle, avatar_url, favorite_team, email_reminders_enabled, onboarding_complete)
  ON public.users TO authenticated;
GRANT UPDATE (display_name, ob_handle, avatar_url, favorite_team, email_reminders_enabled, onboarding_complete)
  ON public.users TO authenticated;

-- Admin UI updates stock_config directly; RLS restricts writes to commissioners/platform admins.
REVOKE ALL ON public.stock_config FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.stock_config TO authenticated;

REVOKE SELECT ON public.stock_accounts FROM anon;
REVOKE SELECT ON public.stock_holdings FROM anon;
REVOKE SELECT ON public.stock_transactions FROM anon;
REVOKE SELECT ON public.stock_prices FROM anon;

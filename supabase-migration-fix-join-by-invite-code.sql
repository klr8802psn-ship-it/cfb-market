-- Applied to project tdpxgddrgbianarsahro on 2026-09-02 (migration: fix_join_stock_league_ambiguous_column).
--
-- join_stock_league_by_invite_code raised 42702 "column reference league_id is ambiguous" on every call
-- because the RETURNS TABLE output column `league_id` shadowed the table column inside
-- ON CONFLICT (league_id, user_id). Nobody had ever successfully joined through the invite link.
-- Output columns renamed; the client (src/pages/Join.jsx) only checks that a row came back.

DROP FUNCTION IF EXISTS public.join_stock_league_by_invite_code(text);

CREATE FUNCTION public.join_stock_league_by_invite_code(p_code text)
RETURNS TABLE(joined_league_id uuid, joined_league_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league_id uuid;
  v_league_name text;
  v_season_id uuid;
  v_start_cash integer;
  v_uid uuid := (select auth.uid());
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

  INSERT INTO public.league_members AS lm (league_id, user_id, role)
  VALUES (v_league_id, v_uid, 'member')
  ON CONFLICT (league_id, user_id) DO NOTHING;

  INSERT INTO public.stock_accounts AS sa (league_id, season_id, user_id, cash)
  VALUES (v_league_id, v_season_id, v_uid, coalesce(v_start_cash, 2000))
  ON CONFLICT (league_id, season_id, user_id) DO NOTHING;

  joined_league_id := v_league_id;
  joined_league_name := v_league_name;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.join_stock_league_by_invite_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_stock_league_by_invite_code(text) TO authenticated;

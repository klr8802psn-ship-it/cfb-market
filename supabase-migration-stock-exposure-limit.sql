-- Exposure limit for stock_trade: longs + shorts (market value) can't exceed portfolio value.
--
-- Applied to Supabase project tdpxgddrgbianarsahro on 2026-09-24 (migration: stock_exposure_limit).
-- Before this, short-sale proceeds landed in cash and could fund more buys. The 40% cap is
-- per team, so stacking shorts and longs across teams gave unbounded leverage (8x+ in testing,
-- and portfolios could go negative). Trades that shrink total exposure are always allowed,
-- so existing over-limit accounts can unwind but not add. Mirrors src/lib/stocks.js.

CREATE OR REPLACE FUNCTION public.stock_trade(p_league_id uuid, p_season_id uuid, p_team_id uuid, p_side text, p_shares integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- constants
  POSITION_CAP constant numeric := 0.40;
  EXPOSURE_CAP constant numeric := 1.0;
  MAX_SHARES_PER_TRADE constant int := 1000000;

  -- caller identity
  v_uid         uuid;

  -- config
  v_start_cash   integer;
  v_trading_open boolean;

  -- current published week (for transaction log)
  v_week_id     uuid;

  -- price
  v_price       numeric;

  -- account + holdings state
  v_cash        numeric;
  v_shares      integer;
  v_new_shares  integer;

  -- portfolio valuation
  v_holdings_value  numeric;
  v_gross           numeric;
  v_gross_after     numeric;
  v_portfolio       numeric;

  -- buy cost
  v_cost            numeric;
  v_holding_val_after numeric;
  v_cash_after        numeric;
  v_portfolio_after   numeric;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not signed in');
  end if;

  if not exists (
    select 1 from league_members lm
    where lm.league_id = p_league_id
      and lm.user_id   = v_uid
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not a member of this league');
  end if;

  select sc.start_cash, sc.trading_open
    into v_start_cash, v_trading_open
    from stock_config sc
   where sc.season_id = p_season_id
     and sc.league_id = p_league_id
     and sc.enabled   = true
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'stock game not enabled');
  end if;

  if not v_trading_open then
    return jsonb_build_object('ok', false, 'reason', 'Trading is closed for the weekend — check back Monday after the settle');
  end if;

  if p_side not in ('buy', 'sell') then
    return jsonb_build_object('ok', false, 'reason', 'side must be buy or sell');
  end if;

  if p_shares <= 0 or p_shares > MAX_SHARES_PER_TRADE then
    return jsonb_build_object('ok', false, 'reason', 'shares must be a positive integer');
  end if;

  select w.id
    into v_week_id
    from weeks w
   where w.season_id = p_season_id
     and w.status    = 'published'
   order by w.week_number desc
   limit 1;

  select sp.price
    into v_price
    from stock_prices sp
   where sp.season_id = p_season_id
     and sp.team_id   = p_team_id
   order by sp.settled_at desc
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'team not priced yet');
  end if;

  insert into stock_accounts (league_id, season_id, user_id, cash)
  values (p_league_id, p_season_id, v_uid, v_start_cash)
  on conflict (league_id, season_id, user_id) do nothing;

  select sa.cash
    into v_cash
    from stock_accounts sa
   where sa.league_id = p_league_id
     and sa.season_id = p_season_id
     and sa.user_id   = v_uid
     for update;

  select coalesce(sh.shares, 0)
    into v_shares
    from stock_holdings sh
   where sh.league_id = p_league_id
     and sh.season_id = p_season_id
     and sh.user_id   = v_uid
     and sh.team_id   = p_team_id;

  if not found then
    v_shares := 0;
  end if;

  select coalesce(sum(h.shares * lp.price), 0),
         coalesce(sum(abs(h.shares * lp.price)), 0)
    into v_holdings_value, v_gross
    from stock_holdings h
    cross join lateral (
      select sp2.price
        from stock_prices sp2
       where sp2.season_id = p_season_id
         and sp2.team_id   = h.team_id
       order by sp2.settled_at desc
       limit 1
    ) lp
   where h.league_id = p_league_id
     and h.season_id = p_season_id
     and h.user_id   = v_uid;

  v_portfolio := v_cash + v_holdings_value;

  if p_side = 'buy' then
    v_cost := p_shares * v_price;

    if v_cost > v_cash then
      return jsonb_build_object('ok', false, 'reason', 'not enough cash');
    end if;

    v_new_shares        := v_shares + p_shares;
    v_holding_val_after := v_new_shares * v_price;
    v_cash_after        := v_cash - v_cost;
  else
    v_new_shares        := v_shares - p_shares;
    v_holding_val_after := v_new_shares * v_price;
    v_cash_after        := v_cash + (p_shares * v_price);
  end if;

  v_portfolio_after := v_cash_after
                       + (v_holdings_value - (v_shares * v_price))
                       + v_holding_val_after;

  if abs(v_new_shares) > abs(v_shares)
     and abs(v_holding_val_after) > POSITION_CAP * v_portfolio_after + 1e-9 then
    return jsonb_build_object('ok', false, 'reason', 'exceeds 40% position cap');
  end if;

  -- Longs + shorts can't exceed portfolio value; shrinking exposure is always allowed.
  v_gross_after := v_gross - abs(v_shares * v_price) + abs(v_holding_val_after);
  if v_gross_after > v_gross + 1e-9
     and v_gross_after > EXPOSURE_CAP * v_portfolio_after + 1e-9 then
    return jsonb_build_object('ok', false, 'reason', 'exceeds exposure limit (longs + shorts can''t top your portfolio value)');
  end if;

  if v_new_shares = 0 then
    delete from stock_holdings
     where league_id = p_league_id
       and season_id = p_season_id
       and user_id   = v_uid
       and team_id   = p_team_id;
  else
    insert into stock_holdings (league_id, season_id, user_id, team_id, shares)
    values (p_league_id, p_season_id, v_uid, p_team_id, v_new_shares)
    on conflict (league_id, season_id, user_id, team_id)
    do update set shares = excluded.shares;
  end if;

  insert into stock_transactions
    (league_id, season_id, user_id, team_id, week_id, side, shares, price)
  values
    (p_league_id, p_season_id, v_uid, p_team_id, v_week_id, p_side, p_shares, v_price);

  update stock_accounts
     set cash = v_cash_after
   where league_id = p_league_id
     and season_id = p_season_id
     and user_id   = v_uid;

  return jsonb_build_object(
    'ok',     true,
    'cash',   v_cash_after,
    'shares', v_new_shares
  );

end;
$function$;

REVOKE EXECUTE ON FUNCTION public.stock_trade(uuid, uuid, uuid, text, integer) FROM anon;

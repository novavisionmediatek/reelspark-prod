-- Credit the missed referral bonus for ONLY these two referrers:
--   priyadevikgp500@gmail.com   (referred shyamadevirai99)
--   shyamadevirai99@gmail.com   (referred ramad00555)
-- Nobody else is touched: no trigger, no global backfill, no changes to the
-- approval functions. Run once in the Supabase SQL Editor.
-- Bonus amount = app_settings.referral_bonus_inr (check it first).
-- Safe to re-run: one bonus per referred user, already-paid ones are skipped.

-- ---- 0) See the current state (read-only) ----
select p.email, p.payment_status, p.referral_balance_inr as balance, r.email as referred_by_email
from public.profiles p
left join public.profiles r on r.id = p.referred_by
where p.email in ('priyadevikgp500@gmail.com', 'shyamadevirai99@gmail.com')
   or p.referred_by in (select id from public.profiles
                        where email in ('priyadevikgp500@gmail.com', 'shyamadevirai99@gmail.com'));

-- ---- 1) Minimal schema support (a manual approval has no payment row) ----
alter table public.referral_earnings
  alter column payment_id drop not null,
  add column if not exists note text;

-- ---- 2) Credit each approved user referred BY one of the two profiles ----
do $$
declare
  r record;
  v_bonus integer;
  v_total integer := 0;
begin
  select coalesce(referral_bonus_inr, 5) into v_bonus from public.app_settings where id = true;

  for r in
    select c.id as referred_id, c.email as referred_email, c.referred_by as referrer_id
    from public.profiles c
    join public.profiles ref on ref.id = c.referred_by
    where ref.email in ('priyadevikgp500@gmail.com', 'shyamadevirai99@gmail.com')
      and c.payment_status = 'approved'
      and c.id <> c.referred_by
      and not exists (select 1 from public.referral_earnings e where e.referred_user_id = c.id)
  loop
    insert into public.referral_earnings (referrer_id, referred_user_id, payment_id, amount_inr, note)
    values (
      r.referrer_id, r.referred_id,
      (select rp.id from public.registration_payments rp
        where rp.user_id = r.referred_id and rp.status = 'approved'
        order by rp.created_at desc limit 1),
      v_bonus,
      'Manual backfill: approved via table editor'
    );

    update public.profiles
    set referral_balance_inr = referral_balance_inr + v_bonus
    where id = r.referrer_id;

    v_total := v_total + v_bonus;
    raise notice 'Credited % to referrer of %', v_bonus, r.referred_email;
  end loop;

  raise notice 'Done. Total credited: %', v_total;
end;
$$;

-- ---- 3) Verify: earnings ledger and balances for the two profiles ----
select ref.email as referrer, usr.email as referred_user, e.amount_inr, e.note, e.created_at
from public.referral_earnings e
join public.profiles ref on ref.id = e.referrer_id
join public.profiles usr on usr.id = e.referred_user_id
where ref.email in ('priyadevikgp500@gmail.com', 'shyamadevirai99@gmail.com');

select email, referral_balance_inr from public.profiles
where email in ('priyadevikgp500@gmail.com', 'shyamadevirai99@gmail.com');

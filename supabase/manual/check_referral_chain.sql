-- Read-only checks for the referral chain
--   priyadevikgp500@gmail.com -> shyamadevirai99@gmail.com -> ramad00555@gmsil.com
-- Run in the Supabase SQL Editor AFTER migration 0016. Nothing here changes data
-- except the optional "set the referrer" statement in step 4 (commented out).
-- NOTE: "gmsil.com" looks like a typo of gmail.com; the LIKE below matches either.

-- 1) Who referred whom, and are they approved?
--    referred_by_email must be filled for the bonus to be payable. If it is NULL
--    the person signed up without a referral code -> go to step 4.
select p.email, p.payment_status, p.referral_balance_inr as balance,
       r.email as referred_by_email
from public.profiles p
left join public.profiles r on r.id = p.referred_by
where p.email in ('priyadevikgp500@gmail.com', 'shyamadevirai99@gmail.com')
   or p.email like 'ramad00555@gm%'
order by p.created_at;

-- 2) Ledger rows created for them (expect: Priya gets 1 for Shyama, Shyama gets 1 for Rama)
select ref.email as referrer, usr.email as referred_user, e.amount_inr, e.note, e.created_at
from public.referral_earnings e
join public.profiles ref on ref.id = e.referrer_id
join public.profiles usr on usr.id = e.referred_user_id
where ref.email in ('priyadevikgp500@gmail.com', 'shyamadevirai99@gmail.com')
   or usr.email like 'ramad00555@gm%'
order by e.created_at;

-- 3) Whole-project audit: anything still wrong shows up here.
--    has_unpaid_referrals = true  -> a referred, approved user has no bonus row
--    balance_mismatch     = true  -> cached balance != earnings - withdrawals
select email, referred_users, referred_users_approved, earned_inr, withdrawn_inr,
       computed_balance_inr, cached_balance_inr, balance_mismatch, has_unpaid_referrals
from public.referral_wallet_summary
where referred_users > 0 or balance_mismatch or has_unpaid_referrals
order by earned_inr desc;

-- 4) ONLY IF step 1 shows referred_by_email is NULL for someone who really was
--    referred: set the referrer. The trigger from 0016 pays the bonus the moment
--    referred_by is set on an approved user. Uncomment, fix the emails, run once.
--
-- update public.profiles
-- set referred_by = (select id from public.profiles where email = 'shyamadevirai99@gmail.com')
-- where email = 'REAL-EMAIL-OF-THE-REFERRED-USER';

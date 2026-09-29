-- An unpaid (not yet approved) user's referral code must not work: signing up
-- with it should NOT link the new user to that referrer at all, so the
-- referrer can never be credited for anyone until they themselves are approved.
--
-- Previously handle_new_user() (0006) linked referred_by to whoever owns the
-- code, with no check on the referrer's payment_status. Fix it at the source —
-- the one place referred_by is ever set on signup — rather than filtering it
-- out later at approval time, so an unpaid user's invite link is a dead link,
-- not a silently-dropped bonus.
--
-- Run once in the Supabase SQL Editor (or `supabase db push`) after 0016.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(upper(trim(new.raw_user_meta_data->>'referral_code')), '');
  v_referrer uuid;
  v_referrer_status text;
begin
  if v_code is not null then
    select id, payment_status into v_referrer, v_referrer_status
    from public.profiles where referral_code = v_code;

    -- only a fully paid/approved referrer's code links the new user; an
    -- unpaid, rejected, or unknown code is treated as no code at all.
    if v_referrer_status is distinct from 'approved' then
      v_referrer := null;
    end if;
  end if;

  insert into public.profiles (id, email, referral_code, referred_by)
  values (new.id, new.email, public.gen_referral_code(), v_referrer);

  return new;
end;
$$;

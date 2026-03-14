-- =============================================================
-- ADMIN SEED SCRIPT
-- Run this in Supabase SQL Editor AFTER you have signed up.
-- Replace 'your-email@example.com' with your actual email.
-- =============================================================

UPDATE public.profiles
SET
    role = 'admin',
    subscription_tier = 'premium',
    subscription_status = 'active',
    is_accredited_investor = TRUE
WHERE email = 'your-email@example.com';

-- Verify it worked (should return 1 row with role = admin)
SELECT id, email, role, subscription_tier FROM public.profiles WHERE role = 'admin';

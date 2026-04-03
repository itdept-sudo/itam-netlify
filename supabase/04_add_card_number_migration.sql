-- ============================================================
-- ITAM DESK — Add Card Number to Production Users
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- Add card_number column to production_users
ALTER TABLE public.production_users 
ADD COLUMN IF NOT EXISTS card_number TEXT;

-- Index for card_number search
CREATE INDEX IF NOT EXISTS idx_production_users_card_num ON public.production_users(card_number);

-- Note: We use TEXT for card_number to avoid issues with leading zeros 
-- if they exist in the card system, even if the user only types numbers.

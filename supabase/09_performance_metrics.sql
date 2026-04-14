-- Add performance tracking columns to tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- Update existing closed tickets to have a closed_at (best effort)
UPDATE public.tickets 
SET closed_at = updated_at 
WHERE status = 'Cerrado' AND closed_at IS NULL;

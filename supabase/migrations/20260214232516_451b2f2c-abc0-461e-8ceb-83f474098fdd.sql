
-- Add new columns for Apple-style recurrence model
ALTER TABLE public.tareas
ADD COLUMN IF NOT EXISTS hora TEXT,
ADD COLUMN IF NOT EXISTS repeat_preset TEXT DEFAULT 'never',
ADD COLUMN IF NOT EXISTS repeat_frequency TEXT,
ADD COLUMN IF NOT EXISTS repeat_interval INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS repeat_byweekday INTEGER[];

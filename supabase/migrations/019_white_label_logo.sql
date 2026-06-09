-- Add logo_url to user_settings for white-label PDF branding
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create logos/ folder policy in screenshots bucket
-- (logos are stored in the same private 'screenshots' bucket, under logos/ prefix)
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', false)
ON CONFLICT (id) DO NOTHING;

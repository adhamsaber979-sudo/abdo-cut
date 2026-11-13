-- ================================================================
-- ABDO CUT - Database Schema for Supabase / PostgreSQL
-- ================================================================

-- Create media table
CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL, -- 'intro', 'before_after', 'reels', 'promos', 'ads', 'motion'
  role VARCHAR(50) NOT NULL DEFAULT 'item', -- 'main', 'before', 'after', 'item'
  group_id UUID NULL, -- links before & after pairs together
  sort_order INT NOT NULL DEFAULT 0,
  ratio VARCHAR(20) NOT NULL DEFAULT '9 / 16',
  video_url TEXT NOT NULL,
  poster_url TEXT NULL,
  public_id TEXT NULL,
  server VARCHAR(50) NOT NULL DEFAULT 'cloudinary', -- 'hyperserve' or 'cloudinary'
  content_type VARCHAR(50) NULL DEFAULT 'video/mp4',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_category ON public.media(category);
CREATE INDEX IF NOT EXISTS idx_media_sort_order ON public.media(sort_order);
CREATE INDEX IF NOT EXISTS idx_media_group_id ON public.media(group_id);
CREATE INDEX IF NOT EXISTS idx_media_server ON public.media(server);

-- Enable Row Level Security (RLS)
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Policy 1: Anyone (including visitors) can read published media
CREATE POLICY "Public Read Media" ON public.media
  FOR SELECT USING (true);

-- Policy 2: Authenticated admins can insert new media
CREATE POLICY "Admin Insert Media" ON public.media
  FOR INSERT TO authenticated WITH CHECK (true);

-- Policy 3: Authenticated admins can update media
CREATE POLICY "Admin Update Media" ON public.media
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Policy 4: Authenticated admins can delete media
CREATE POLICY "Admin Delete Media" ON public.media
  FOR DELETE TO authenticated USING (true);

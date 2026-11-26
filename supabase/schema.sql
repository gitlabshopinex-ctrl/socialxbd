-- SocialX text-data schema for Supabase (media binaries live in Shopinex storage).
create table if not exists public.users (
  id integer primary key,
  handle text not null unique,
  name text not null,
  avatar_url text,
  bio text,
  verified boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.videos (
  id integer primary key,
  user_id integer references public.users(id) on delete cascade,
  author_handle text,
  author_name text,
  caption text,
  music_name text,
  video_url text,
  cover_url text,
  media_urls text,
  media_id text,
  cover_media_id text,
  storage_provider text default 'shopinex',
  status text default 'approved',
  moderation_reason text,
  views_count integer default 0,
  likes_count integer default 0,
  comments_count integer default 0,
  saves_count integer default 0,
  shares_count integer default 0,
  created_at timestamptz default now(),
  moderated_at timestamptz
);

create table if not exists public.comments (
  id integer primary key,
  video_id integer references public.videos(id) on delete cascade,
  user_id integer references public.users(id) on delete cascade,
  text text not null,
  likes_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.media_assets (
  id integer primary key,
  provider text default 'shopinex',
  remote_id text,
  url text not null,
  file_name text,
  mime_type text,
  kind text,
  size_bytes integer default 0,
  video_id integer,
  uploaded_by text,
  created_at timestamptz default now()
);

create table if not exists public.moderation_logs (
  id integer primary key,
  video_id integer,
  action text,
  status text,
  author_handle text,
  caption_snapshot text,
  image_score numeric,
  text_score numeric,
  image_verdict text,
  text_verdict text,
  reason text,
  details text,
  created_at timestamptz default now(),
  reviewed_by text,
  reviewed_at timestamptz
);

alter table public.users enable row level security;
alter table public.videos enable row level security;
alter table public.comments enable row level security;
alter table public.media_assets enable row level security;
alter table public.moderation_logs enable row level security;

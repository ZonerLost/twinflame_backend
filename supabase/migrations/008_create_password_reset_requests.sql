create table if not exists public.password_reset_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending','approved','denied','expired','completed')),
  approval_token text not null unique,
  reset_token text not null unique,
  approved_at timestamptz,
  denied_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_password_reset_requests_email
on public.password_reset_requests(email);

create index if not exists idx_password_reset_requests_status
on public.password_reset_requests(status);

create index if not exists idx_password_reset_requests_user_id
on public.password_reset_requests(user_id);

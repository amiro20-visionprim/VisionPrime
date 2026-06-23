-- Phase 03: auth, RBAC, business settings, audit/security logging.
-- See /docs/database-conventions.md for naming/UUID/timestamp/soft-delete rules.

create extension if not exists pgcrypto;

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);
create index if not exists idx_role_permissions_permission_id on role_permissions(permission_id);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text not null,
  is_active boolean not null default true,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_users_deleted_at on users(deleted_at);

create table if not exists user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index if not exists idx_user_roles_role_id on user_roles(role_id);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  refresh_token_hash text not null unique,
  user_agent text,
  ip_address text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_expires_at on sessions(expires_at);

create table if not exists business_settings (
  id uuid primary key default gen_random_uuid(),
  general jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  appearance jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

-- Append-only: no updated_at/deleted_at — see database-conventions.md §6.
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  action text not null,
  target_type text not null,
  target_id text,
  before jsonb,
  after jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);
create index if not exists idx_audit_logs_actor_id on audit_logs(actor_id);
create index if not exists idx_audit_logs_target on audit_logs(target_type, target_id);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_logs_created_at on activity_logs(created_at);
create index if not exists idx_activity_logs_actor_id on activity_logs(actor_id);

create table if not exists security_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity text not null default 'medium',
  user_id uuid references users(id),
  email text,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_security_events_created_at on security_events(created_at);
create index if not exists idx_security_events_type on security_events(type);

-- System-defined permissions (see /docs/permissions.md). Not creatable via API.
insert into permissions (key, description) values
  ('auth:login', 'Authenticate as an admin user'),
  ('user:view', 'View admin users'),
  ('user:create', 'Create admin users'),
  ('user:update', 'Update admin users'),
  ('user:delete', 'Delete (deactivate) admin users'),
  ('role:view', 'View roles'),
  ('role:create', 'Create roles'),
  ('role:update', 'Update roles and their permissions'),
  ('role:delete', 'Delete roles'),
  ('permission:view', 'View the system permission catalog'),
  ('settings:view', 'View business settings'),
  ('settings:manage', 'Update business settings'),
  ('audit:view', 'View audit and activity logs'),
  ('security_event:view', 'View security events')
on conflict (key) do nothing;

-- Default system role: Super Admin holds every permission and cannot be
-- deleted. Custom roles are created via the Roles API on top of this.
insert into roles (name, description, is_system)
values ('Super Admin', 'Full system access. Cannot be deleted.', true)
on conflict (name) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'Super Admin'
on conflict do nothing;

-- Single business settings row (general/features/appearance default empty).
insert into business_settings (general, features, appearance)
select '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
where not exists (select 1 from business_settings);

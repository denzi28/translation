-- Classroom Blog — initial schema
-- All application tables live in the `app` schema, which is deliberately NOT
-- exposed through Supabase's public REST API. The Next.js server is the only
-- client, and it connects as the dedicated `app_user` role.

create schema if not exists app;

-- ---------------------------------------------------------------- users ----
create table if not exists app.users (
  id             uuid primary key default gen_random_uuid(),
  role           text not null check (role in ('STUDENT', 'TEACHER', 'ADMIN')),
  email          text unique,
  username       text unique,
  full_name      text not null,
  student_number text unique,
  password_hash  text not null,
  created_at     timestamptz not null default now(),
  -- Students sign in with an email and always carry a student number;
  -- staff accounts sign in with a username.
  constraint users_identity_ck check (
    (role = 'STUDENT' and email is not null and student_number is not null)
    or (role in ('TEACHER', 'ADMIN') and username is not null)
  )
);

create table if not exists app.sessions (
  token      text primary key,
  user_id    uuid not null references app.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on app.sessions(user_id);

-- --------------------------------------------------------------- groups ----
create table if not exists app.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text not null default '',
  invite_code text not null unique,
  created_by  uuid not null references app.users(id),
  created_at  timestamptz not null default now()
);

create table if not exists app.group_members (
  group_id  uuid not null references app.groups(id) on delete cascade,
  user_id   uuid not null references app.users(id) on delete cascade,
  is_owner  boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  -- A student belongs to at most one group at any given time.
  constraint group_members_one_group_uk unique (user_id)
);
create index if not exists group_members_group_idx on app.group_members(group_id);

-- Groups hold between 1 and 5 members; the lower bound is implicit (the
-- creator joins on creation), the upper bound is enforced here.
create or replace function app.enforce_group_capacity() returns trigger as $$
declare
  member_count int;
begin
  select count(*) into member_count from app.group_members where group_id = new.group_id;
  if member_count >= 5 then
    raise exception 'GROUP_FULL' using errcode = '23514';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists group_members_capacity on app.group_members;
create trigger group_members_capacity
  before insert on app.group_members
  for each row execute function app.enforce_group_capacity();

-- Invitations (group -> student) and join requests (student -> group).
create table if not exists app.group_requests (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references app.groups(id) on delete cascade,
  user_id     uuid not null references app.users(id) on delete cascade,
  kind        text not null check (kind in ('INVITE', 'REQUEST')),
  status      text not null default 'PENDING'
                check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
  created_by  uuid not null references app.users(id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists group_requests_pending_uk
  on app.group_requests(group_id, user_id, kind) where status = 'PENDING';
create index if not exists group_requests_user_idx on app.group_requests(user_id);

-- ---------------------------------------------------------------- posts ----
create table if not exists app.posts (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references app.groups(id) on delete cascade,
  title        text not null,
  content_html text not null default '',
  status       text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED')),
  created_by   uuid not null references app.users(id),
  updated_by   uuid references app.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists posts_group_idx on app.posts(group_id);
create index if not exists posts_published_idx on app.posts(status, published_at desc);

-- ------------------------------------------------- teacher feedback --------
-- Readable only by the authoring staff member, any admin/teacher, and the
-- members of the group it targets. Enforced in the data-access layer.
create table if not exists app.feedback (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references app.groups(id) on delete cascade,
  post_id    uuid references app.posts(id) on delete cascade,
  author_id  uuid not null references app.users(id),
  grade      int check (grade between 0 and 100),
  comment    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists feedback_group_idx on app.feedback(group_id, created_at desc);

-- ----------------------------------------------- course guidelines PDF ------
create table if not exists app.guidelines (
  id          int primary key default 1 check (id = 1),
  filename    text not null,
  mime_type   text not null default 'application/pdf',
  byte_size   int not null,
  data        bytea not null,
  uploaded_by uuid references app.users(id),
  uploaded_at timestamptz not null default now()
);

-- ----------------------------------------------------------- seed users ----
insert into app.users (role, username, full_name, password_hash)
values ('TEACHER', 'devrim.gunay', 'Devrim Günay',
        'scrypt$965826e223445f52be0a70fc7d0872aa$56c84bc4758a6e9e05a7552bfe6bccf8aa6a6b899b589e1fba3e6b6ac23ff61561b1e45290b4f62d3393359156bd73bead084caa07af12826541cca395d1bd32')
on conflict (username) do nothing;

insert into app.users (role, username, full_name, password_hash)
values ('ADMIN', 'admin323123', 'System Administrator',
        'scrypt$6cc65a2272857fa7b3c4b73ef56f3de7$142a07437dfac4d143eddb51f89ed53f25dbaa41154fe6d90aa1f78974e247cc4b5e86e73cf61245db14a79aa3dd5918078bdbc413e4171ef490a964177d7d99')
on conflict (username) do nothing;

-- ---------------------------------------------------------------- grants ----
grant usage on schema app to app_user;
grant select, insert, update, delete on all tables in schema app to app_user;
grant usage, select on all sequences in schema app to app_user;
alter default privileges in schema app
  grant select, insert, update, delete on tables to app_user;
alter default privileges in schema app
  grant usage, select on sequences to app_user;

-- ============================================================================
-- «Мопсик вдвоём» — схема базы данных PostgreSQL 14+
--
-- MVP работает на файловом хранилище (server/store.js) с точно такой же
-- структурой. Этот файл — продакшн-схема: достаточно переключить слой
-- репозитория на pg/Supabase (см. docs/BACKEND.md).
--
--   psql -d mopsy -f sql/schema.sql
--   psql -d mopsy -f sql/seed.sql
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- регистронезависимые логины

-- --------------------------------------------------------------------- users
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      citext unique not null check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name  text not null check (char_length(display_name) between 1 and 24),
  password_hash text,                       -- null для Telegram-only аккаунтов
  password_salt text,
  telegram_id   bigint unique,
  avatar_emoji  text not null default '🐶',
  locale        text not null default 'ru',
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  constraint users_has_identity check (password_hash is not null or telegram_id is not null)
);

create table if not exists sessions (
  token      text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expires_idx on sessions(expires_at);

-- ---------------------------------------------------------------------- pets
create table if not exists pets (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 2 and 20),
  color            text not null default 'fawn'
                     check (color in ('fawn', 'apricot', 'silver', 'black')),
  level            int  not null default 1 check (level >= 1),
  xp               int  not null default 0 check (xp >= 0),
  coins            int  not null default 120 check (coins >= 0),
  care_points      int  not null default 0,
  room             text not null default 'room_cozy',
  equipped         jsonb not null default '{"hat":null,"glasses":null,"bandana":null,"outfit":null}'::jsonb,
  sleep_until      timestamptz,
  streak           int not null default 0,
  streak_last_day  date,
  last_daily_claim date,
  invite_code      text unique not null,
  reminder_times   jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

-- максимум два владельца у питомца
create table if not exists pet_owners (
  id        uuid primary key default gen_random_uuid(),
  pet_id    uuid not null references pets(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  role      text not null default 'owner' check (role in ('owner', 'co-owner')),
  joined_at timestamptz not null default now(),
  unique (pet_id, user_id)
);
create index if not exists pet_owners_user_idx on pet_owners(user_id);

create or replace function enforce_two_owners() returns trigger language plpgsql as $$
begin
  if (select count(*) from pet_owners where pet_id = new.pet_id) >= 2 then
    raise exception 'У питомца уже два владельца (pet %)', new.pet_id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists pet_owners_limit on pet_owners;
create trigger pet_owners_limit before insert on pet_owners
  for each row execute function enforce_two_owners();

-- ---------------------------------------------------------------- pet_stats
create table if not exists pet_stats (
  pet_id     uuid primary key references pets(id) on delete cascade,
  satiety    numeric(5,1) not null default 78  check (satiety    between 0 and 100),
  hydration  numeric(5,1) not null default 80  check (hydration  between 0 and 100),
  energy     numeric(5,1) not null default 72  check (energy     between 0 and 100),
  mood       numeric(5,1) not null default 85  check (mood       between 0 and 100),
  health     numeric(5,1) not null default 92  check (health     between 0 and 100),
  hygiene    numeric(5,1) not null default 88  check (hygiene    between 0 and 100),
  love       numeric(5,1) not null default 40  check (love       between 0 and 100),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- actions
create table if not exists actions (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid not null references pets(id) on delete cascade,
  user_id         uuid references users(id) on delete set null,
  type            text not null,             -- feed | water | play | walk | pat | wash | sleep | heal | praise | game | buy | dress | task | daily
  text            text not null,
  meta            jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at      timestamptz not null default now(),
  unique (pet_id, idempotency_key)           -- защита от повторной отправки действия
);
create index if not exists actions_pet_time_idx on actions(pet_id, created_at desc);
create index if not exists actions_pet_type_idx on actions(pet_id, type, created_at desc);

-- -------------------------------------------------------- каталог и инвентарь
create table if not exists clothes (
  id     text primary key,                   -- hat_party, glasses_sun, ...
  name   text not null,
  slot   text not null check (slot in ('hat', 'glasses', 'bandana', 'outfit')),
  price  int  not null check (price >= 0),
  rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic')),
  emoji  text not null default '🎀',
  color  text not null default '#FF7A59'
);

create table if not exists rooms (
  id    text primary key,                    -- room_cozy, room_space, ...
  name  text not null,
  price int not null default 0 check (price >= 0),
  emoji text not null default '🏡'
);

create table if not exists inventory (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references pets(id) on delete cascade,
  item_id     text not null,                 -- clothes.id или rooms.id
  quantity    int  not null default 1 check (quantity > 0),
  acquired_at timestamptz not null default now(),
  unique (pet_id, item_id)
);

-- --------------------------------------------------------------- достижения
create table if not exists achievements (
  code        text primary key,              -- first_feed, level_5, streak_7 ...
  title       text not null,
  description text not null,
  icon        text not null default '🏅',
  coins       int  not null default 20,
  xp          int  not null default 30
);

create table if not exists pet_achievements (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references pets(id) on delete cascade,
  code        text not null references achievements(code),
  unlocked_at timestamptz not null default now(),
  unique (pet_id, code)
);

-- ------------------------------------------------------------- daily_tasks
create table if not exists daily_tasks (
  id         uuid primary key default gen_random_uuid(),
  pet_id     uuid not null references pets(id) on delete cascade,
  date       date not null default current_date,
  code       text not null,
  title      text not null,
  icon       text not null default '🎯',
  metric     text not null,                  -- feed | water | play | walk | game | care | coop
  target     int  not null check (target > 0),
  coins      int  not null default 20,
  xp         int  not null default 30,
  is_coop    boolean not null default false,
  claimed    boolean not null default false,
  claimed_by uuid references users(id),
  claimed_at timestamptz,
  unique (pet_id, date, code)
);
create index if not exists daily_tasks_pet_date_idx on daily_tasks(pet_id, date);

-- ------------------------------------------------------------ notifications
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  pet_id     uuid not null references pets(id) on delete cascade,
  user_id    uuid references users(id) on delete cascade,  -- null = обоим хозяевам
  type       text not null,                  -- partner_action | reminder | daily | achievement | partner_join
  icon       text not null default '🔔',
  text       text not null,
  read_by    uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists notifications_pet_idx on notifications(pet_id, created_at desc);

-- ============================================================================
-- Представления для клиента
-- ============================================================================

create or replace view v_pet_full as
select p.*,
       s.satiety, s.hydration, s.energy, s.mood, s.health, s.hygiene, s.love,
       s.updated_at as stats_updated_at,
       (select count(*) from pet_owners o where o.pet_id = p.id) as owners_count
from pets p
join pet_stats s on s.pet_id = p.id;

-- рейтинг заботы (для будущих сезонов и лидербордов)
create or replace view v_care_leaderboard as
select p.id, p.name, p.level, p.care_points, p.streak,
       row_number() over (order by p.care_points desc) as rank
from pets p;

-- ============================================================================
-- Supabase Row Level Security (пример)
-- Включайте, если используете Supabase Auth и клиентский доступ к таблицам.
-- При доступе только через backend (service_role) RLS не требуется.
-- ============================================================================
-- alter table pets enable row level security;
-- create policy pets_read on pets for select
--   using (exists (select 1 from pet_owners o where o.pet_id = pets.id and o.user_id = auth.uid()));
-- create policy pets_update on pets for update
--   using (exists (select 1 from pet_owners o where o.pet_id = pets.id and o.user_id = auth.uid()));

-- ============================================================================
-- Удобные функции
-- ============================================================================

-- Начислить опыт с автоуровнями (порог: 90 + (level-1)*70).
create or replace function add_pet_xp(p_pet uuid, p_xp int) returns table (level int, xp int) language plpgsql as $$
declare v_level int; v_xp int; v_need int;
begin
  select p.level, p.xp into v_level, v_xp from pets p where p.id = p_pet for update;
  v_xp := v_xp + p_xp;
  v_need := 90 + (v_level - 1) * 70;
  while v_xp >= v_need loop
    v_xp := v_xp - v_need;
    v_level := v_level + 1;
    v_need := 90 + (v_level - 1) * 70;
  end loop;
  update pets set level = v_level, xp = v_xp where id = p_pet;
  return query select v_level, v_xp;
end $$;

-- Деградация показателей по реальному времени (аналог applyDecay в engine.js).
create or replace function apply_pet_decay(p_pet uuid) returns pet_stats language plpgsql as $$
declare st pet_stats; hours numeric;
begin
  select * into st from pet_stats where pet_id = p_pet for update;
  hours := least(36, greatest(0, extract(epoch from (now() - st.updated_at)) / 3600));
  update pet_stats set
    satiety   = greatest(0, st.satiety   - 4.4 * hours),
    hydration = greatest(0, st.hydration - 5.2 * hours),
    mood      = greatest(0, st.mood      - 3.4 * hours),
    hygiene   = greatest(0, st.hygiene   - 2.2 * hours),
    love      = greatest(0, st.love      - 0.9 * hours),
    energy    = greatest(0, least(100, st.energy - 3.0 * hours)),
    health    = greatest(0, least(100, st.health +
                  case when st.satiety < 20 or st.hydration < 20 then -1.4 * hours else 0.5 * hours end)),
    updated_at = now()
  where pet_id = p_pet
  returning * into st;
  return st;
end $$;

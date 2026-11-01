-- ============================================================================
-- Демонстрационные данные для PostgreSQL-версии.
-- Для MVP-файлового хранилища аналог — server/seed.js (npm run seed).
-- Пароль демо-игроков: demo1234 (bcrypt через pgcrypto; в Node-версии — scrypt).
-- ============================================================================

-- ---------------------------------------------------------------- каталоги
insert into clothes (id, name, slot, price, rarity, emoji, color) values
  ('hat_party',      'Праздничный колпак',     'hat',     120, 'common', '🎉', '#F27AA1'),
  ('hat_beanie',     'Вязаная шапка',          'hat',      90, 'common', '🧶', '#7FB77E'),
  ('hat_cap',        'Кепка-путешественника',  'hat',     140, 'common', '🧢', '#4FB6E8'),
  ('hat_crown',      'Корона мопса',           'hat',     380, 'epic',   '👑', '#F2C94C'),
  ('glasses_round',  'Круглые очки',           'glasses', 130, 'common', '🤓', '#6B5B4B'),
  ('glasses_sun',    'Солнечные очки',         'glasses', 170, 'rare',   '🕶️', '#2F2B3A'),
  ('glasses_heart',  'Очки-сердечки',          'glasses', 260, 'rare',   '💕', '#E86BA4'),
  ('bandana_red',    'Красная бандана',        'bandana', 110, 'common', '🧣', '#EB5757'),
  ('bandana_scarf',  'Тёплый шарф',            'bandana', 150, 'common', '🧣', '#8B7BE0'),
  ('bow_tie',        'Бабочка-джентльмен',     'bandana', 220, 'rare',   '🎀', '#6B5B4B'),
  ('outfit_sweater', 'Уютный свитер',          'outfit',  240, 'rare',   '🧥', '#D98C5F'),
  ('outfit_pajama',  'Пижама в звёздочку',     'outfit',  200, 'common', '🌙', '#8B7BE0'),
  ('outfit_hero',    'Костюм супермопса',      'outfit',  420, 'epic',   '🦸', '#4FB6E8'),
  ('outfit_santa',   'Костюм Деда Мороза',     'outfit',  360, 'epic',   '🎅', '#EB5757')
on conflict (id) do nothing;

insert into rooms (id, name, price, emoji) values
  ('room_cozy',   'Уютная комната',  0,   '🛋️'),
  ('room_garden', 'Летний сад',      150, '🌻'),
  ('room_beach',  'Пляж',            220, '🏖️'),
  ('room_winter', 'Зимняя сказка',   320, '❄️'),
  ('room_space',  'Космос',          400, '🚀')
on conflict (id) do nothing;

insert into achievements (code, title, description, icon, coins, xp) values
  ('first_feed', 'Первая ложка',   'Покормите мопса первый раз',    '🍖', 10, 20),
  ('first_walk', 'Первая прогулка','Выгуляйте мопса',               '🌳', 15, 25),
  ('first_bath', 'Чистюля',        'Искупайте мопса',               '🛁', 15, 25),
  ('first_game', 'Игрок',          'Пройдите мини-игру',            '🎮', 15, 25),
  ('feed_10',    'Заботливый',     'Покормите мопса 10 раз',        '🥣', 30, 50),
  ('level_5',    'Пятый уровень',  'Достигните 5 уровня мопса',     '🏅', 50, 60),
  ('level_10',   'Мопс-легенда',   'Достигните 10 уровня',          '🏆', 100, 120),
  ('streak_3',   'Три дня подряд', 'Серия заботы 3 дня',            '🔥', 40, 60),
  ('streak_7',   'Неделя вместе',  'Серия заботы 7 дней',           '🔥', 80, 100),
  ('duo_online', 'Вдвоём веселее', 'Второй игрок присоединился',     '👫', 40, 50),
  ('all_happy',  'Полный порядок', 'Все показатели выше 80',        '✨', 35, 45),
  ('shopper',    'Модник',         'Купите первый аксессуар',       '🛍️', 20, 30)
on conflict (code) do nothing;

-- ------------------------------------------------------------- демо-игроки
insert into users (username, display_name, password_hash, password_salt, avatar_emoji)
values
  ('anya', 'Аня',  encode(digest('demo1234', 'sha256'), 'hex'), 'demo', '👩'),
  ('ilya', 'Илья', encode(digest('demo1234', 'sha256'), 'hex'), 'demo', '🧑')
on conflict (username) do nothing;

-- -------------------------------------------------------------- демо-мопсик
with anya as (select id from users where username = 'anya'),
     ilya as (select id from users where username = 'ilya'),
     new_pet as (
       insert into pets (name, color, level, xp, coins, care_points, room,
                         invite_code, streak, streak_last_day, last_daily_claim, equipped, created_at)
       values ('Бублик', 'fawn', 4, 120, 285, 148, 'room_cozy',
               'BUBLIK', 4, current_date, current_date,
               '{"hat":"hat_party","glasses":null,"bandana":"bandana_red","outfit":null}'::jsonb,
               now() - interval '12 days')
       returning id, name
     ),
     owners as (
       insert into pet_owners (pet_id, user_id, role, joined_at)
       select new_pet.id, anya.id, 'owner', now() - interval '12 days' from new_pet, anya
       union all
       select new_pet.id, ilya.id, 'co-owner', now() - interval '3 days' from new_pet, ilya
       returning pet_id, user_id
     ),
     st as (
       insert into pet_stats (pet_id, satiety, hydration, energy, mood, health, hygiene, love)
       select id, 64, 58, 71, 82, 88, 46, 66 from new_pet
       returning pet_id
     ),
     inv as (
       insert into inventory (pet_id, item_id)
       select new_pet.id, item from new_pet,
         unnest(array['hat_party', 'glasses_round', 'bandana_red', 'outfit_sweater']) as item
       returning item_id
     ),
     acts as (
       insert into actions (pet_id, user_id, type, text, created_at)
       select new_pet.id, ilya.id, 'feed', 'Илья кормит Бублика', now() - interval '26 minutes' from new_pet, ilya
       union all
       select new_pet.id, anya.id, 'play', 'Аня играет с Бубликом', now() - interval '52 minutes' from new_pet, anya
       union all
       select new_pet.id, ilya.id, 'walk', 'Илья гуляет с Бубликом', now() - interval '2 hours' from new_pet, ilya
       returning id
     )
insert into pet_achievements (pet_id, code)
select new_pet.id, code from new_pet,
  unnest(array['first_feed', 'first_walk', 'first_bath', 'first_game', 'duo_online', 'shopper']) as code
on conflict do nothing;

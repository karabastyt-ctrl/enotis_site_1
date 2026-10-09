-- 001_init: первая схема базы (спецификация 2.1, раздел 11).
-- Применённые миграции не редактируются: любые изменения — новым файлом 002_…, 003_…
-- Таблицу schema_version и PRAGMA (foreign_keys, WAL) создаёт движок, app/db.php.

-- [2.1] is_active = включён на сайте, is_default = основной
CREATE TABLE languages (
  code TEXT PRIMARY KEY CHECK (code IN ('ru','ka','en','fr')), name TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 0
);

-- Настройки без языка: header_show, header_burger (auto|on|off), footer_show, footer_email, footer_phone,
-- cookie_notice, currency, req_format, operator_id, maps, show_prices (настройки сайта без табов и общих блоков);
-- [2.1] logo_path, logo_with_title, favicon_path, og_image_path, counter_code,
-- mail_from, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
-- photo_service (claid|photoroom), photo_api_key, launch_payment_checked,
-- update_checked_at, update_latest, backup_last_day
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
-- Настройки с языком: site_title, seo_title, seo_description
CREATE TABLE settings_i18n (key TEXT NOT NULL, lang TEXT NOT NULL REFERENCES languages(code), value TEXT, PRIMARY KEY (key, lang));

-- [2.1] email, ui_lang, сброс пароля; запись одна (вход один, без ролей)
CREATE TABLE admins (
  id INTEGER PRIMARY KEY, login TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  email TEXT, ui_lang TEXT NOT NULL DEFAULT 'ru' CHECK (ui_lang IN ('ru','ka','en','fr')),
  failed_count INTEGER NOT NULL DEFAULT 0, locked_until TEXT,
  reset_hash TEXT, reset_until TEXT, reset_sent TEXT     -- reset_sent: время писем за последний час (JSON)
);

-- [2.1] обработанный файл и режим фотосервиса; второй кадр для верха страницы плитки
CREATE TABLE photos (
  id INTEGER PRIMARY KEY,
  original_path TEXT NOT NULL,
  processed_path TEXT,
  process_mode TEXT CHECK (process_mode IN ('studio','enhance')),
  use_processed INTEGER NOT NULL DEFAULT 0,
  aspect TEXT NOT NULL DEFAULT '4:5' CHECK (aspect IN ('3:2','4:5')),
  crop_x REAL, crop_y REAL, crop_w REAL, crop_h REAL, rotate REAL NOT NULL DEFAULT 0,
  path_l TEXT, path_m TEXT, path_s TEXT,          -- 1600/800/400 или 1200/600/300
  head_crop_x REAL, head_crop_y REAL, head_crop_w REAL, head_crop_h REAL,   -- кадр 3:2 верха страницы
  head_path_l TEXT, head_path_m TEXT, head_path_s TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE operators (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'RU' CHECK (country IN ('RU','GE','other')),
  tax_id TEXT, reg_no TEXT, address TEXT, email TEXT
);

-- Табы
CREATE TABLE sections (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'RUB',
  req_format TEXT NOT NULL DEFAULT 'RU' CHECK (req_format IN ('RU','GE','other')),
  operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL,
  maps TEXT NOT NULL DEFAULT 'google' CHECK (maps IN ('google','yandex')),
  show_prices INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE section_i18n (
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  lang TEXT NOT NULL REFERENCES languages(code), title TEXT,
  PRIMARY KEY (section_id, lang)
);

CREATE TABLE domains (
  host TEXT PRIMARY KEY,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,   -- NULL = весь сайт
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE domain_i18n (
  host TEXT NOT NULL REFERENCES domains(host) ON DELETE CASCADE,
  lang TEXT NOT NULL REFERENCES languages(code), site_title TEXT,
  PRIMARY KEY (host, lang)
);

CREATE TABLE docs (key TEXT PRIMARY KEY CHECK (key IN ('offer','privacy','cookies')), hidden INTEGER NOT NULL DEFAULT 1);
CREATE TABLE doc_i18n (
  key TEXT NOT NULL REFERENCES docs(key) ON DELETE CASCADE,
  lang TEXT NOT NULL REFERENCES languages(code), title TEXT, body TEXT,
  PRIMARY KEY (key, lang)
);

-- Блоки и плитки.
-- section_id: NULL — главная без табов или общие блоки над табами (и всё внутри них); иначе — таб.
-- parent_id: NULL — блок главной/таба; блок Плитки — для плитки; плитка — для блока её страницы.
CREATE TABLE elements (
  id INTEGER PRIMARY KEY,
  section_id INTEGER REFERENCES sections(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES elements(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text','photo','tiles','tile','map','pay','service','tabs')),
  position INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,
  slug TEXT,                                                    -- tile
  as_page INTEGER NOT NULL DEFAULT 0,                           -- tile уровня 1
  tiles_size TEXT CHECK (tiles_size IN ('large','compact')),    -- tiles
  frame TEXT CHECK (frame IN ('3:2','4:5')),                    -- [2.1] tiles (у вин всегда 4:5), photo
  tiles_kind TEXT CHECK (tiles_kind IN ('normal','wine')),      -- tiles
  title_size TEXT CHECK (title_size IN ('l','m','s')),          -- text
  body_size TEXT CHECK (body_size IN ('lead','normal','small')),-- text
  photo_width TEXT CHECK (photo_width IN ('full','narrow')),    -- photo
  photo_id INTEGER REFERENCES photos(id) ON DELETE SET NULL,    -- tile, photo
  lat REAL, lng REAL,                                           -- tile
  link_url TEXT,                                                -- service
  price REAL,                                                   -- service, вино
  wine_color TEXT CHECK (wine_color IN ('red','white','rose','amber')),
  wine_sweet TEXT CHECK (wine_sweet IN ('dry','semidry','semisweet','sweet')),
  vintage INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX elements_one_per_page ON elements (COALESCE(section_id,0), COALESCE(parent_id,0), type) WHERE type IN ('map','pay');
CREATE UNIQUE INDEX elements_one_tabs ON elements (type) WHERE type = 'tabs';
CREATE INDEX elements_tree ON elements (section_id, parent_id, position);

CREATE TABLE element_i18n (
  element_id INTEGER NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  lang TEXT NOT NULL REFERENCES languages(code),
  eyebrow TEXT,          -- Текст: надзаголовок
  title TEXT,            -- заголовок / название
  subtitle TEXT,         -- Текст: подзаголовок; плитка и вино: подпись; Фото: подпись
  body TEXT,             -- текст / описание
  place TEXT,            -- «Как добраться»
  grape TEXT,            -- вино: сорт
  button_label TEXT,     -- Оплата, Услуга
  recipient TEXT,        -- «Кому идут деньги»
  pay_purpose TEXT,      -- назначение платежа
  price_note TEXT,       -- Услуга: подпись к цене
  seo_title TEXT, seo_description TEXT,
  PRIMARY KEY (element_id, lang)
);

CREATE TABLE pay_methods (
  id INTEGER PRIMARY KEY,
  element_id INTEGER NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('link','qr','requisites')),
  provider TEXT, enabled INTEGER NOT NULL DEFAULT 1,
  url TEXT, qr_path TEXT, req_json TEXT
);
CREATE TABLE pay_method_i18n (
  method_id INTEGER NOT NULL REFERENCES pay_methods(id) ON DELETE CASCADE,
  lang TEXT NOT NULL REFERENCES languages(code), label TEXT,
  PRIMARY KEY (method_id, lang)
);

-- [2.1] добавлен x
CREATE TABLE social_links (
  network TEXT PRIMARY KEY CHECK (network IN ('telegram','vk','youtube','rutube','dzen','ok','whatsapp','viber','max','instagram','facebook','tiktok','x')),
  url TEXT, position INTEGER NOT NULL
);

-- Значения по умолчанию для чистой базы (раздел 11, «При установке»).
-- Мастер установки (этап 8) потом меняет основной язык и создаёт администратора.
INSERT INTO languages (code, name, position, is_default, is_active) VALUES
  ('ru', 'Русский',  1, 1, 1),
  ('ka', 'ქართული',  2, 0, 0),
  ('en', 'English',  3, 0, 0),
  ('fr', 'Français', 4, 0, 0);

INSERT INTO social_links (network, url, position) VALUES
  ('telegram', NULL, 1), ('vk', NULL, 2), ('youtube', NULL, 3), ('rutube', NULL, 4),
  ('dzen', NULL, 5), ('ok', NULL, 6), ('whatsapp', NULL, 7), ('viber', NULL, 8),
  ('max', NULL, 9), ('instagram', NULL, 10), ('facebook', NULL, 11), ('tiktok', NULL, 12),
  ('x', NULL, 13);

INSERT INTO settings (key, value) VALUES
  ('header_show', '1'), ('header_burger', 'auto'), ('footer_show', '1'), ('cookie_notice', '1'),
  ('currency', 'RUB'), ('req_format', 'RU'), ('maps', 'google'), ('show_prices', '1'),
  ('logo_with_title', '1'), ('photo_service', 'claid');

INSERT INTO docs (key, hidden) VALUES ('offer', 1), ('privacy', 1), ('cookies', 1);

-- sql/schema.sql
-- ─────────────────────────────────────────────────────────────
-- This file creates every table CampusWallet needs.
-- Run it once to set up the database from scratch.
--
-- WHAT IS A SCHEMA?
-- The schema is the blueprint of your database — it defines
-- what tables exist, what columns each table has, what data
-- types those columns hold, and how tables relate to each other.
--
-- HOW TO RE-RUN THIS SAFELY:
-- Every statement uses IF NOT EXISTS or IF EXISTS.
-- This means you can run this file multiple times without
-- destroying existing data or throwing errors.
-- ─────────────────────────────────────────────────────────────

-- Make sure we are working in the right database
USE campuswallet;

-- ── LOOKUP TABLES ─────────────────────────────────────────────
-- These tables hold the categories. They are created first
-- because the main data tables (expenses, income) reference them
-- via foreign keys. You cannot create a child table before
-- the parent table it references exists.

CREATE TABLE IF NOT EXISTS income_categories (
  category_id  TINYINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name         VARCHAR(60)         NOT NULL,
  description  VARCHAR(200)            NULL,
  is_active    TINYINT(1)          NOT NULL DEFAULT 1,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_income_cat_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expense_categories (
  category_id  TINYINT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name         VARCHAR(60)         NOT NULL,
  icon         VARCHAR(10)         NOT NULL DEFAULT '📌',
  description  VARCHAR(200)            NULL,
  is_active    TINYINT(1)          NOT NULL DEFAULT 1,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_expense_cat_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── USERS ─────────────────────────────────────────────────────
-- The central table. Every other data table links back to this
-- one via user_id. This is what enforces data privacy —
-- every query for expenses, income, etc. always includes
-- WHERE user_id = ? so users only ever see their own data.

CREATE TABLE IF NOT EXISTS users (
  user_id        INT UNSIGNED        NOT NULL AUTO_INCREMENT,
  username       VARCHAR(40)         NOT NULL,
  email          VARCHAR(120)        NOT NULL,
  password_hash  VARCHAR(255)        NOT NULL,
  full_name      VARCHAR(100)        NOT NULL,
  university     VARCHAR(120)            NULL,
  course         VARCHAR(100)            NULL,
  year_of_study  TINYINT UNSIGNED        NULL,
  currency       CHAR(3)             NOT NULL DEFAULT 'KES',
  is_active      TINYINT(1)          NOT NULL DEFAULT 1,
  created_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_email    (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── EXPENSES ──────────────────────────────────────────────────
-- Stores every expense a user records.
-- DECIMAL(12,2) means up to 12 digits total, 2 after the decimal.
-- e.g. 9999999999.99 — more than enough for KES amounts.
-- Using DECIMAL (not FLOAT) because FLOAT has rounding errors
-- with money. 0.1 + 0.2 in FLOAT is not exactly 0.3.

CREATE TABLE IF NOT EXISTS expenses (
  expense_id        INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED     NOT NULL,
  category_id       TINYINT UNSIGNED NOT NULL,
  amount            DECIMAL(12,2)    NOT NULL,
  transaction_date  DATE             NOT NULL,
  description       VARCHAR(200)         NULL,
  payment_method    ENUM(
                      'Mobile Money',
                      'Cash',
                      'Card',
                      'Bank Transfer'
                    )                NOT NULL DEFAULT 'Mobile Money',
  created_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (expense_id),
  -- This index speeds up the most common query:
  -- "get all expenses for user X in month Y"
  KEY idx_exp_user_date (user_id, transaction_date),
  KEY idx_exp_category  (category_id),
  CONSTRAINT fk_exp_user     FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_exp_category FOREIGN KEY (category_id)
    REFERENCES expense_categories (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── INCOME ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS income (
  income_id      INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED     NOT NULL,
  category_id    TINYINT UNSIGNED NOT NULL,
  amount         DECIMAL(12,2)    NOT NULL,
  received_date  DATE             NOT NULL,
  description    VARCHAR(200)         NULL,
  is_recurring   TINYINT(1)       NOT NULL DEFAULT 0,
  created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (income_id),
  KEY idx_inc_user_date (user_id, received_date),
  KEY idx_inc_category  (category_id),
  CONSTRAINT fk_inc_user     FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_inc_category FOREIGN KEY (category_id)
    REFERENCES income_categories (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── BUDGETS ───────────────────────────────────────────────────
-- One row per user per category = their monthly spending limit.
-- The UNIQUE KEY ensures a user cannot have two budgets
-- for the same category.

CREATE TABLE IF NOT EXISTS budgets (
  budget_id      INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED     NOT NULL,
  category_id    TINYINT UNSIGNED NOT NULL,
  monthly_limit  DECIMAL(12,2)    NOT NULL,
  created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (budget_id),
  UNIQUE KEY uq_budget_user_cat (user_id, category_id),
  CONSTRAINT fk_bud_user     FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_bud_category FOREIGN KEY (category_id)
    REFERENCES expense_categories (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── SAVING GOALS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saving_goals (
  goal_id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED  NOT NULL,
  name           VARCHAR(100)  NOT NULL,
  target_amount  DECIMAL(12,2) NOT NULL,
  saved_amount   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  target_date    DATE              NULL,
  description    VARCHAR(200)      NULL,
  is_complete    TINYINT(1)    NOT NULL DEFAULT 0,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (goal_id),
  KEY idx_goal_user (user_id),
  CONSTRAINT fk_goal_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── SEED DATA ─────────────────────────────────────────────────
-- INSERT IGNORE means: insert this row, but if the name already
-- exists (hits the UNIQUE KEY), skip it silently.
-- This makes the seed safe to run multiple times.

INSERT IGNORE INTO income_categories (name, description) VALUES
  ('HELB Disbursement',    'Higher Education Loans Board payment'),
  ('Parental Support',     'Money from parents or guardians'),
  ('Scholarship',          'Bursary or scholarship payment'),
  ('Part-time Employment', 'Regular wages alongside studies'),
  ('Freelance / Gig',      'Design, tutoring, online work'),
  ('Business Income',      'Revenue from a small business'),
  ('Prize / Award',        'Hackathon, academic prize, competition'),
  ('Loan',                 'Personal loan from family or lender'),
  ('Other Income',         'Anything not covered above');

INSERT IGNORE INTO expense_categories (name, icon, description) VALUES
  ('Food & Dining',    '🍽️',  'Canteen, groceries, takeaways'),
  ('Rent & Housing',   '🏠',  'Hostel, rent, utilities'),
  ('Transport',        '🚌',  'Matatu, bus, boda, Uber'),
  ('Airtime & Data',   '📱',  'Bundles, airtime top-ups'),
  ('School Supplies',  '📚',  'Books, printing, stationery'),
  ('Health',           '💊',  'Pharmacy, clinic, medical'),
  ('Entertainment',    '🎬',  'Movies, events, outings'),
  ('Clothing',         '👕',  'Clothes, shoes, accessories'),
  ('Savings Transfer', '💰',  'Money moved to savings'),
  ('Personal Care',    '🪥',  'Toiletries, haircut, salon'),
  ('Family Support',   '🏡',  'Money sent home'),
  ('Other',            '📌',  'Anything not covered above');
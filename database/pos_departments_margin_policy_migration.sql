-- ===============================================
-- POS Departments Margin Policy Columns
-- Adds default markup and auto-pricing policy per department.
-- Safe to run multiple times.
-- ===============================================

ALTER TABLE IF EXISTS pos_departments
ADD COLUMN IF NOT EXISTS default_markup_percentage NUMERIC(10,2) NOT NULL DEFAULT 30.00;

ALTER TABLE IF EXISTS pos_departments
ADD COLUMN IF NOT EXISTS auto_pricing_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ===============================================
-- POS Departments Master Table
-- Supports managed departments while keeping product.category compatible
-- ===============================================

CREATE TABLE IF NOT EXISTS pos_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30),
    description VARCHAR(255),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce one department name per outlet (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_departments_outlet_name_unique
    ON pos_departments (outlet_id, lower(name));

-- Optional unique code per outlet
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_departments_outlet_code_unique
    ON pos_departments (outlet_id, code)
    WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_departments_outlet_active
    ON pos_departments (outlet_id, is_active, sort_order, name);

-- Keep updated_at current on updates (uses shared trigger function from base migration)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'update_updated_at_column'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'update_pos_departments_updated_at'
        ) THEN
            CREATE TRIGGER update_pos_departments_updated_at
            BEFORE UPDATE ON pos_departments
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END IF;
END
$$;

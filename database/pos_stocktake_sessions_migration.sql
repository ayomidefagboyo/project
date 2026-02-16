-- ===============================================
-- POS Stocktake Sessions Migration
-- Adds first-class stocktake session reporting table
-- ===============================================

CREATE TABLE IF NOT EXISTS pos_stocktake_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    terminal_id VARCHAR(120),
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_by_staff_profile_id UUID REFERENCES staff_profiles(id) ON DELETE SET NULL,
    performed_by_name VARCHAR(255),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed')),
    total_items INTEGER NOT NULL DEFAULT 0 CHECK (total_items >= 0),
    adjusted_items INTEGER NOT NULL DEFAULT 0 CHECK (adjusted_items >= 0),
    unchanged_items INTEGER NOT NULL DEFAULT 0 CHECK (unchanged_items >= 0),
    positive_variance_items INTEGER NOT NULL DEFAULT 0 CHECK (positive_variance_items >= 0),
    negative_variance_items INTEGER NOT NULL DEFAULT 0 CHECK (negative_variance_items >= 0),
    net_quantity_variance INTEGER NOT NULL DEFAULT 0,
    total_variance_value DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_stocktake_sessions_outlet_completed
    ON pos_stocktake_sessions(outlet_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_stocktake_sessions_performed_by
    ON pos_stocktake_sessions(performed_by, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_stocktake_sessions_staff_profile
    ON pos_stocktake_sessions(performed_by_staff_profile_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_stock_movements_reference_type_id
    ON pos_stock_movements(reference_type, reference_id);

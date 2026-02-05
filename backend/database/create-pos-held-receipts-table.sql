-- ===============================================
-- POS Held Receipts Table
-- Stores sales that are put on hold (parked carts)
-- Allows cashiers to hold multiple receipts and restore them later
-- Date: February 2025
-- ===============================================

-- ===============================================
-- POS HELD RECEIPTS TABLE
-- Stores held receipts (parked carts) for POS system
-- ===============================================
CREATE TABLE IF NOT EXISTS pos_held_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cashier_name VARCHAR(255) NOT NULL,
    
    -- Cart items stored as JSONB for flexibility
    -- Structure: [{"product_id": "...", "quantity": 1, "unit_price": 100.00, "discount": 0, "product_name": "...", "sku": "...", ...}]
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Total amount for the held receipt
    total DECIMAL(12,2) NOT NULL CHECK (total >= 0),
    
    -- When the receipt was saved/held
    saved_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ===============================================
-- INDEXES FOR PERFORMANCE
-- ===============================================

-- Index for querying held receipts by outlet
CREATE INDEX IF NOT EXISTS idx_pos_held_receipts_outlet_id 
    ON pos_held_receipts(outlet_id);

-- Index for querying held receipts by cashier
CREATE INDEX IF NOT EXISTS idx_pos_held_receipts_cashier_id 
    ON pos_held_receipts(cashier_id);

-- Index for sorting by saved_at (most recent first)
CREATE INDEX IF NOT EXISTS idx_pos_held_receipts_saved_at 
    ON pos_held_receipts(saved_at DESC);

-- Composite index for outlet + saved_at queries
CREATE INDEX IF NOT EXISTS idx_pos_held_receipts_outlet_saved_at 
    ON pos_held_receipts(outlet_id, saved_at DESC);

-- ===============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ===============================================

-- Enable RLS
ALTER TABLE pos_held_receipts ENABLE ROW LEVEL SECURITY;

-- Note: This assumes the user_has_outlet_access function exists from pos-system-migration.sql
-- If it doesn't exist, create it first:
-- CREATE OR REPLACE FUNCTION user_has_outlet_access(outlet_uuid UUID)
-- RETURNS BOOLEAN AS $$
-- BEGIN
--     RETURN EXISTS (
--         SELECT 1 FROM users u
--         JOIN outlets o ON u.outlet_id = o.id
--         WHERE u.id = auth.uid()
--         AND (u.outlet_id = outlet_uuid OR o.owner_id = auth.uid())
--     );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy: Users can view held receipts for outlets they have access to
CREATE POLICY "pos_held_receipts_select" ON pos_held_receipts
    FOR SELECT USING (user_has_outlet_access(outlet_id));

-- Policy: Users can create held receipts for outlets they have access to
CREATE POLICY "pos_held_receipts_insert" ON pos_held_receipts
    FOR INSERT WITH CHECK (user_has_outlet_access(outlet_id));

-- Policy: Users can delete held receipts in their outlets
CREATE POLICY "pos_held_receipts_delete" ON pos_held_receipts
    FOR DELETE USING (user_has_outlet_access(outlet_id));

-- ===============================================
-- COMMENTS FOR DOCUMENTATION
-- ===============================================
COMMENT ON TABLE pos_held_receipts IS 'Stores sales that are put on hold (parked carts) in the POS system';
COMMENT ON COLUMN pos_held_receipts.items IS 'JSONB array of cart items with product details: [{"product_id": "...", "quantity": 1, "unit_price": 100.00, "discount": 0, "product_name": "...", "sku": "...", "barcode": "...", "tax_rate": 0.075, "category": "..."}]';
COMMENT ON COLUMN pos_held_receipts.saved_at IS 'Timestamp when the receipt was put on hold';
COMMENT ON COLUMN pos_held_receipts.cashier_name IS 'Cached cashier name for display purposes';

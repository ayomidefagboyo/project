-- Pharmacy patient profiles and vitals tracking (safe for existing DBs).

CREATE TABLE IF NOT EXISTS pos_patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    patient_code VARCHAR(30) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    gender VARCHAR(20) DEFAULT 'unspecified',
    date_of_birth DATE,
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(30),
    allergies TEXT,
    chronic_conditions TEXT,
    current_medications TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_visit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (outlet_id, patient_code)
);

CREATE INDEX IF NOT EXISTS idx_pos_patient_profiles_outlet
    ON pos_patient_profiles (outlet_id);

CREATE INDEX IF NOT EXISTS idx_pos_patient_profiles_search
    ON pos_patient_profiles (outlet_id, full_name, phone, patient_code);

CREATE TABLE IF NOT EXISTS pos_patient_vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES pos_patient_profiles(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    pulse_bpm INTEGER,
    temperature_c NUMERIC(5,2),
    respiratory_rate INTEGER,
    oxygen_saturation INTEGER,
    blood_glucose_mmol NUMERIC(6,2),
    weight_kg NUMERIC(7,2),
    height_cm NUMERIC(7,2),
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_patient_vitals_patient
    ON pos_patient_vitals (patient_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_patient_vitals_outlet
    ON pos_patient_vitals (outlet_id, recorded_at DESC);

COMMENT ON TABLE pos_patient_profiles IS 'Pharmacy patient profiles managed from POS pharmacist workflow.';
COMMENT ON TABLE pos_patient_vitals IS 'Patient vitals history captured by pharmacist in POS.';

-- FLEETPILOT DATABASE SCHEMA

-- REMOVE EXISTING TABLES

-- Remove existing tables in dependency order.
-- This is destructive: use only for the FleetPilot database.

DROP TABLE IF EXISTS expenses, maintenance, trips, vehicles;

-- 1. VEHICLES TABLE

CREATE TABLE vehicles (

    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    registration_number TEXT NOT NULL UNIQUE,
    name_model TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',

    initial_odometer_km INTEGER NOT NULL DEFAULT 0,
    acquired_on DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT registration_is_clean
        CHECK (
            registration_number = upper(replace(registration_number, ' ', '')) -- > Checks the number entered by Converting the number entered into UPPER Case & Then Replacing the whitespaces from the number entered --> with no space
            AND length(registration_number) BETWEEN 4 AND 15
        ),

    CONSTRAINT name_model_not_blank
        CHECK (length(trim(name_model)) > 0), -- > trim() removes the spaces from start and end

    CONSTRAINT valid_vehicle_type
        CHECK (
            vehicle_type IN ('bus', 'coach', 'minibus', 'van', 'other')
        ),

    CONSTRAINT valid_vehicle_status
        CHECK (
            status IN ('active', 'in_maintenance', 'inactive')
        ),

    CONSTRAINT initial_odometer_not_negative
        CHECK (initial_odometer_km >= 0)
);


-- 2. TRIPS TABLE

CREATE TABLE trips (

    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    vehicle_id INTEGER NOT NULL
        REFERENCES vehicles (id) ON DELETE RESTRICT,

    status TEXT NOT NULL DEFAULT 'scheduled',

    origin TEXT NOT NULL,
    destination TEXT NOT NULL,

    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,

    start_odometer_km INTEGER,
    end_odometer_km INTEGER,

    distance_km INTEGER GENERATED ALWAYS AS
        (end_odometer_km - start_odometer_km) STORED, -- > used generated column

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT valid_trip_status
        CHECK (
            status IN ('scheduled', 'in_progress', 'completed', 'cancelled')
        ),

    CONSTRAINT odometers_not_negative
        CHECK (
            start_odometer_km >= 0
            AND end_odometer_km >= 0
        ),

    CONSTRAINT end_odometer_needs_start
        CHECK (
            end_odometer_km IS NULL
            OR start_odometer_km IS NOT NULL
        ),

    CONSTRAINT end_odometer_after_start
        CHECK (end_odometer_km >= start_odometer_km),

    CONSTRAINT end_time_after_start
        CHECK (end_at >= start_at),

    CONSTRAINT in_progress_needs_start_odometer
        CHECK (
            status <> 'in_progress'
            OR start_odometer_km IS NOT NULL
        ),

    CONSTRAINT completed_needs_readings_and_end_time
        CHECK (
            status <> 'completed'
            OR (
                start_odometer_km IS NOT NULL
                AND end_odometer_km IS NOT NULL
                AND end_at IS NOT NULL
            )
        )

);

-- TRIPS INDEXES

CREATE UNIQUE INDEX one_in_progress_trip_per_vehicle
    ON trips (vehicle_id)
    WHERE status = 'in_progress';

CREATE INDEX trips_vehicle_id_idx
    ON trips (vehicle_id);

CREATE INDEX trips_end_at_idx
    ON trips (end_at);


-- 3. MAINTENANCE TABLE

CREATE TABLE maintenance (

    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    vehicle_id INTEGER NOT NULL
        REFERENCES vehicles (id) ON DELETE RESTRICT,

    service_date DATE NOT NULL,
    service_type TEXT NOT NULL,
    description TEXT,

    odometer_km INTEGER,

    next_service_date DATE,
    next_service_odometer_km INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT service_type_not_blank
        CHECK (length(trim(service_type)) > 0),

    CONSTRAINT maintenance_odometer_not_negative
        CHECK (odometer_km >= 0),

    CONSTRAINT next_service_date_after_service
        CHECK (next_service_date > service_date),

    CONSTRAINT next_service_odometer_after_reading
        CHECK (next_service_odometer_km > odometer_km)

);

-- MAINTENANCE INDEXES

-- Improve searches based on vehicle ID.

CREATE INDEX maintenance_vehicle_id_idx
    ON maintenance (vehicle_id);

-- 4. EXPENSES TABLE

CREATE TABLE expenses (

    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    vehicle_id INTEGER NOT NULL
        REFERENCES vehicles (id) ON DELETE RESTRICT,

    expense_date DATE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,

    maintenance_id INTEGER UNIQUE
        REFERENCES maintenance (id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT valid_expense_category
        CHECK (
            category IN (
                'fuel',
                'maintenance',
                'tolls_parking',
                'insurance_permits',
                'other'
            )
        ),

    CONSTRAINT amount_in_range
        CHECK (
            amount > 0
            AND amount <= 1000000
        ),

    CONSTRAINT linked_expense_is_maintenance
        CHECK (
            maintenance_id IS NULL
            OR category = 'maintenance'
        )

);

-- EXPENSES INDEXES

-- Improve searches based on vehicle ID.

CREATE INDEX expenses_vehicle_id_idx
    ON expenses (vehicle_id);


-- Improve searches based on expense date.

CREATE INDEX expenses_expense_date_idx
    ON expenses (expense_date);





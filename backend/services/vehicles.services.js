
// Everything FleetPilot does with vehicles in the database.
// Routes call these functions; only this file writes SQL about vehicles.

import { pool } from '../db/pool.js';
import { createError } from '../middleware/errors.js';

// The columns every vehicle response contains, including the CALCULATED
// current odometer: the highest known reading (decision D-01).
const VEHICLE_COLUMNS = `
  v.id,
  v.registration_number,
  v.name_model,
  v.vehicle_type,
  v.status,
  v.initial_odometer_km,
  v.acquired_on,
  GREATEST(
     v.initial_odometer_km,
     (SELECT MAX(t.end_odometer_km) FROM trips t
       WHERE t.vehicle_id = v.id AND t.status = 'completed'),
     (SELECT MAX(m.odometer_km) FROM maintenance m
       WHERE m.vehicle_id = v.id)
  ) AS current_odometer_km,
  v.created_at,
  v.updated_at
`;

// List vehicles, with optional filters and pages.
export async function listVehicles({ filters, page, limit }) {
  const conditions = [];
  const values = [];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`v.status = $${values.length}`);
  }

  if (filters.type) {
    values.push(filters.type);
    conditions.push(`v.vehicle_type = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`(v.registration_number ILIKE $${values.length} OR v.name_model ILIKE $${values.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // How many vehicles match in total (for "page 1 of 3")
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM vehicles v ${where}`,
    values
  );

  const total = countResult.rows[0].total;

  // One page of them
  const offset = (page - 1) * limit;

  const rowsResult = await pool.query(
    `SELECT ${VEHICLE_COLUMNS}
     FROM vehicles v
     ${where}
     ORDER BY v.registration_number
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );

  return { vehicles: rowsResult.rows, total };
}

// One vehicle by id, or a 404 error.
export async function getVehicle(id) {
  const result = await pool.query(
    `SELECT ${VEHICLE_COLUMNS} FROM vehicles v WHERE v.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw createError(404, 'VEHICLE_NOT_FOUND', `Vehicle ${id} not found`);
  }

  return result.rows[0];
}


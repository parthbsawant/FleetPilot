import { pool } from '../db/pool.js';
import { createError } from '../middleware/errors.js';

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

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM vehicles v ${where}`,
    values
  );

  const total = countResult.rows[0].total;

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

function explainDatabaseError(err, values) {
    if (
        err.code === '23505' &&
        err.constraint === 'vehicles_registration_number_key'
    ) {
        return createError(
            409,
            'DUPLICATE_REGISTRATION',
            `A vehicle with registration number ${values.registration_number} already exists`,
            {
                registration_number: 'Already used by another vehicle'
            }
        );
    }

    return err;
}

const EDITABLE_COLUMNS = [
    'registration_number',
    'name_model',
    'vehicle_type',
    'status',
    'initial_odometer_km',
    'acquired_on'
];

export async function createVehicle(values) {
    const columns = EDITABLE_COLUMNS.filter(
        (column) => values[column] !== undefined
    );

    const placeholders = columns.map(
        (column, index) => `$${index + 1}`
    );

    const params = columns.map(
        (column) => values[column]
    );

    let result;

    try {
        result = await pool.query(
            `INSERT INTO vehicles (${columns.join(', ')})
             VALUES (${placeholders.join(', ')})
             RETURNING id`,
            params
        );
    } catch (err) {
        throw explainDatabaseError(err, values);
    }

    return getVehicle(result.rows[0].id);
}

export async function updateVehicle(id, values) {
    const columns = EDITABLE_COLUMNS.filter(
        (column) => values[column] !== undefined
    );

    const assignments = columns.map(
        (column, index) => `${column} = $${index + 1}`
    );

    const params = columns.map(
        (column) => values[column]
    );

    params.push(id);

    let result;

    try {
        result = await pool.query(
            `UPDATE vehicles
             SET ${assignments.join(', ')}, updated_at = now()
             WHERE id = $${params.length}
             RETURNING id`,
            params
        );
    } catch (err) {
        throw explainDatabaseError(err, values);
    }

    if (result.rows.length === 0) {
        throw createError(
            404,
            'VEHICLE_NOT_FOUND',
            `Vehicle ${id} not found`
        );
    }

    return getVehicle(id);
}

export async function deleteVehicle(id) {
    let result;

    try {
        result = await pool.query(
            'DELETE FROM vehicles WHERE id = $1 RETURNING id',
            [id]
        );
    } catch (err) {
        if (err.code === '23503') {
            throw createError(
                409,
                'VEHICLE_HAS_HISTORY',
                'This vehicle has trips, services or expenses, so it cannot be deleted. Set its status to inactive instead.'
            );
        }

        throw err;
    }

    if (result.rows.length === 0) {
        throw createError(
            404,
            'VEHICLE_NOT_FOUND',
            `Vehicle ${id} not found`
        );
    }
}
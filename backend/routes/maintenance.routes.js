
// The maintenance routes. Each route: read the request -> run SQL -> send the answer.
// Same idea as trips.routes.js: no separate validation file. The CHECK rules in
// schema.sql refuse bad records, and errors.js turns refusals into messages.
// One extra route, /alerts, tells which vehicles need a service soon.

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { createError } from '../middleware/errors.js';

export const maintenanceRouter = Router();


// ---------- Small helpers ----------

// The columns every maintenance answer contains.
// The JOIN brings the vehicle's registration number along with each record.
// DATE columns already come back as text like "2026-11-18" (set up in pool.js).
const MAINTENANCE_COLUMNS = `
    m.id,
    m.vehicle_id,
    v.registration_number,
    m.service_date,
    m.service_type,
    m.description,
    m.odometer_km,
    m.next_service_date,
    m.next_service_odometer_km
`;

// An empty form field arrives as '' -> store it as NULL (no value)
function emptyToNull(value) {
    if (value === undefined || value === null) return null;

    const text = String(value).trim();

    return text === '' ? null : text;
}

// The 7 values for INSERT and UPDATE, in the same order as the columns
function maintenanceValues(body) {
    return [
        emptyToNull(body.vehicle_id),
        emptyToNull(body.service_date),
        emptyToNull(body.service_type),
        emptyToNull(body.description),
        emptyToNull(body.odometer_km),
        emptyToNull(body.next_service_date),
        emptyToNull(body.next_service_odometer_km)
    ];
}

// One record by id, or a 404 error
async function getMaintenance(id) {
    const result = await pool.query(
        `SELECT ${MAINTENANCE_COLUMNS}
         FROM maintenance m
         JOIN vehicles v ON v.id = m.vehicle_id
         WHERE m.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw createError(404, 'MAINTENANCE_NOT_FOUND', `Service record ${id} not found`);
    }

    return result.rows[0];
}

// Decides a vehicle's alert from days left and km left (decision D-05).
// Either one can be null when the last service didn't set it.
function alertState(daysLeft, kmLeft) {
    if (daysLeft === null && kmLeft === null) {
        return 'no_schedule';
    }

    if ((daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft <= 0)) {
        return 'overdue';
    }

    if ((daysLeft !== null && daysLeft <= 14) || (kmLeft !== null && kmLeft <= 1000)) {
        return 'due_soon';
    }

    return 'ok';
}


// ---------- GET /api/maintenance/alerts ----------
// Must come BEFORE '/:id', or Express would treat "alerts" as an id.

maintenanceRouter.get('/alerts', async (req, res) => {
    // For every vehicle that is not inactive:
    //   - its newest service record (the subquery inside the LEFT JOIN)
    //   - days_left: next service date minus today in India (DATE - DATE = days)
    //   - current_odometer_km: the same calculation as the vehicles list
    const result = await pool.query(`
        SELECT
            v.id AS vehicle_id,
            v.registration_number,
            v.name_model,
            m.service_date AS last_service_date,
            m.next_service_date,
            m.next_service_odometer_km,
            m.next_service_date - (now() AT TIME ZONE 'Asia/Kolkata')::date AS days_left,
            GREATEST(
                v.initial_odometer_km,
                (SELECT MAX(t.end_odometer_km) FROM trips t
                  WHERE t.vehicle_id = v.id AND t.status = 'completed'),
                (SELECT MAX(mm.odometer_km) FROM maintenance mm
                  WHERE mm.vehicle_id = v.id)
            ) AS current_odometer_km
        FROM vehicles v
        LEFT JOIN maintenance m ON m.id = (
            SELECT m2.id FROM maintenance m2
            WHERE m2.vehicle_id = v.id
            ORDER BY m2.service_date DESC, m2.id DESC
            LIMIT 1
        )
        WHERE v.status <> 'inactive'
        ORDER BY v.registration_number
    `);

    // Add km_left and the alert state to every row
    const alerts = result.rows.map((row) => {
        const kmLeft = row.next_service_odometer_km === null
            ? null
            : row.next_service_odometer_km - row.current_odometer_km;

        return {
            ...row,
            km_left: kmLeft,
            state: alertState(row.days_left, kmLeft)
        };
    });

    res.json({
        data: alerts,
        meta: {
            overdue: alerts.filter((a) => a.state === 'overdue').length,
            due_soon: alerts.filter((a) => a.state === 'due_soon').length
        }
    });
});


// ---------- GET /api/maintenance?vehicle_id=3&from=...&to=...&search=tyre&page=1 ----------

maintenanceRouter.get('/', async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    // Build the WHERE from the filters that were sent (same idea as trips)
    const conditions = [];
    const values = [];

    if (req.query.vehicle_id) {
        values.push(req.query.vehicle_id);
        conditions.push(`m.vehicle_id = $${values.length}`);
    }

    if (req.query.from) {
        values.push(req.query.from);
        conditions.push(`m.service_date >= $${values.length}`);
    }

    if (req.query.to) {
        values.push(req.query.to);
        conditions.push(`m.service_date <= $${values.length}`);
    }

    if (req.query.search) {
        values.push(`%${req.query.search}%`);
        conditions.push(`(
            m.service_type ILIKE $${values.length}
            OR m.description ILIKE $${values.length}
            OR v.registration_number ILIKE $${values.length}
        )`);
    }

    const where = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    // Query 1: how many records match (for the pager)
    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM maintenance m
         JOIN vehicles v ON v.id = m.vehicle_id
         ${where}`,
        values
    );

    // Query 2: one page of records, newest first
    const rowsResult = await pool.query(
        `SELECT ${MAINTENANCE_COLUMNS}
         FROM maintenance m
         JOIN vehicles v ON v.id = m.vehicle_id
         ${where}
         ORDER BY m.service_date DESC, m.id DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
    );

    res.json({
        data: rowsResult.rows,
        meta: {
            page,
            limit,
            total: countResult.rows[0].total
        }
    });
});


// ---------- GET /api/maintenance/4 ----------

maintenanceRouter.get('/:id', async (req, res) => {
    const record = await getMaintenance(req.params.id);

    res.json({ data: record });
});


// ---------- POST /api/maintenance ----------

maintenanceRouter.post('/', async (req, res) => {
    const result = await pool.query(
        `INSERT INTO maintenance
            (vehicle_id, service_date, service_type, description,
             odometer_km, next_service_date, next_service_odometer_km)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        maintenanceValues(req.body)
    );

    const record = await getMaintenance(result.rows[0].id);

    res.status(201).json({ data: record });
});


// ---------- PATCH /api/maintenance/4 ----------
// The form always sends every field, so we simply update every column.

maintenanceRouter.patch('/:id', async (req, res) => {
    const result = await pool.query(
        `UPDATE maintenance
         SET vehicle_id = $1,
             service_date = $2,
             service_type = $3,
             description = $4,
             odometer_km = $5,
             next_service_date = $6,
             next_service_odometer_km = $7,
             updated_at = now()
         WHERE id = $8
         RETURNING id`,
        [...maintenanceValues(req.body), req.params.id]
    );

    if (result.rows.length === 0) {
        throw createError(404, 'MAINTENANCE_NOT_FOUND', `Service record ${req.params.id} not found`);
    }

    const record = await getMaintenance(req.params.id);

    res.json({ data: record });
});


// ---------- DELETE /api/maintenance/4 ----------

maintenanceRouter.delete('/:id', async (req, res) => {
    const result = await pool.query(
        'DELETE FROM maintenance WHERE id = $1 RETURNING id',
        [req.params.id]
    );

    if (result.rows.length === 0) {
        throw createError(404, 'MAINTENANCE_NOT_FOUND', `Service record ${req.params.id} not found`);
    }

    res.json({ data: { id: Number(req.params.id), deleted: true } });
});

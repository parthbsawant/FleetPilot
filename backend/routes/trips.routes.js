
// The trips routes. Each route: read the request -> run SQL -> send the answer.
// There is no separate validation file: the CHECK rules in schema.sql refuse
// bad trips, and errors.js turns those refusals into readable messages.

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { createError } from '../middleware/errors.js';

export const tripsRouter = Router();


// ---------- Small helpers ----------

// The columns every trip answer contains.
// Times are turned into India time text, like "2026-11-18T09:30".
// The JOIN brings the vehicle's registration number along with each trip.
const TRIP_COLUMNS = `
    t.id,
    t.vehicle_id,
    v.registration_number,
    t.status,
    t.origin,
    t.destination,
    to_char(t.start_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS start_at,
    to_char(t.end_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') AS end_at,
    t.start_odometer_km,
    t.end_odometer_km,
    t.distance_km,
    t.notes
`;

// An empty form field arrives as '' -> store it as NULL (no value)
function emptyToNull(value) {
    if (value === undefined || value === null) return null;

    const text = String(value).trim();

    return text === '' ? null : text;
}

// "2026-11-18T09:30" (India time from the form) -> "2026-11-18T09:30+05:30"
function toIndiaTime(value) {
    const text = emptyToNull(value);

    return text === null ? null : `${text}+05:30`;
}

// The 9 values for INSERT and UPDATE, in the same order as the columns
function tripValues(body) {
    return [
        emptyToNull(body.vehicle_id),
        emptyToNull(body.status) ?? 'scheduled',
        emptyToNull(body.origin),
        emptyToNull(body.destination),
        toIndiaTime(body.start_at),
        toIndiaTime(body.end_at),
        emptyToNull(body.start_odometer_km),
        emptyToNull(body.end_odometer_km),
        emptyToNull(body.notes)
    ];
}

// One trip by id, or a 404 error
async function getTrip(id) {
    const result = await pool.query(
        `SELECT ${TRIP_COLUMNS}
         FROM trips t
         JOIN vehicles v ON v.id = t.vehicle_id
         WHERE t.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw createError(404, 'TRIP_NOT_FOUND', `Trip ${id} not found`);
    }

    return result.rows[0];
}


// ---------- GET /api/trips?vehicle_id=3&status=completed&from=...&to=...&search=pune&page=1 ----------

tripsRouter.get('/', async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    // Build the WHERE from the filters that were sent (same idea as vehicles)
    const conditions = [];
    const values = [];

    if (req.query.vehicle_id) {
        values.push(req.query.vehicle_id);
        conditions.push(`t.vehicle_id = $${values.length}`);
    }

    if (req.query.status) {
        values.push(req.query.status);
        conditions.push(`t.status = $${values.length}`);
    }

    // Dates are compared as India dates: "started on or after this day"
    if (req.query.from) {
        values.push(req.query.from);
        conditions.push(`(t.start_at AT TIME ZONE 'Asia/Kolkata')::date >= $${values.length}`);
    }

    if (req.query.to) {
        values.push(req.query.to);
        conditions.push(`(t.start_at AT TIME ZONE 'Asia/Kolkata')::date <= $${values.length}`);
    }

    if (req.query.search) {
        values.push(`%${req.query.search}%`);
        conditions.push(`(
            t.origin ILIKE $${values.length}
            OR t.destination ILIKE $${values.length}
            OR v.registration_number ILIKE $${values.length}
        )`);
    }

    const where = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    // Query 1: how many trips match (for the pager)
    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM trips t
         JOIN vehicles v ON v.id = t.vehicle_id
         ${where}`,
        values
    );

    // Query 2: one page of trips, newest first
    const rowsResult = await pool.query(
        `SELECT ${TRIP_COLUMNS}
         FROM trips t
         JOIN vehicles v ON v.id = t.vehicle_id
         ${where}
         ORDER BY t.start_at DESC, t.id DESC
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


// ---------- GET /api/trips/42 ----------

tripsRouter.get('/:id', async (req, res) => {
    const trip = await getTrip(req.params.id);

    res.json({ data: trip });
});


// ---------- POST /api/trips ----------

tripsRouter.post('/', async (req, res) => {
    const result = await pool.query(
        `INSERT INTO trips
            (vehicle_id, status, origin, destination, start_at, end_at,
             start_odometer_km, end_odometer_km, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        tripValues(req.body)
    );

    // Read it back with the registration number and India times
    const trip = await getTrip(result.rows[0].id);

    res.status(201).json({ data: trip });
});


// ---------- PATCH /api/trips/42 ----------
// The form always sends every field, so we simply update every column.

tripsRouter.patch('/:id', async (req, res) => {
    const result = await pool.query(
        `UPDATE trips
         SET vehicle_id = $1,
             status = $2,
             origin = $3,
             destination = $4,
             start_at = $5,
             end_at = $6,
             start_odometer_km = $7,
             end_odometer_km = $8,
             notes = $9,
             updated_at = now()
         WHERE id = $10
         RETURNING id`,
        [...tripValues(req.body), req.params.id]
    );

    if (result.rows.length === 0) {
        throw createError(404, 'TRIP_NOT_FOUND', `Trip ${req.params.id} not found`);
    }

    const trip = await getTrip(req.params.id);

    res.json({ data: trip });
});


// ---------- DELETE /api/trips/42 ----------
// Completed trips are history, so the WHERE never deletes them.

tripsRouter.delete('/:id', async (req, res) => {
    const result = await pool.query(
        `DELETE FROM trips
         WHERE id = $1 AND status <> 'completed'
         RETURNING id`,
        [req.params.id]
    );

    if (result.rows.length === 0) {
        throw createError(
            409,
            'TRIP_NOT_DELETED',
            'Trip not found, or it is completed. Completed trips are kept as history.'
        );
    }

    res.json({ data: { id: Number(req.params.id), deleted: true } });
});

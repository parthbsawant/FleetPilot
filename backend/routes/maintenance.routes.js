
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { createError } from '../middleware/errors.js';

export const maintenanceRouter = Router();

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

function emptyToNull(value) {
    if (value === undefined || value === null) return null;

    const text = String(value).trim();

    return text === '' ? null : text;
}

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


maintenanceRouter.get('/alerts', async (req, res) => {
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


maintenanceRouter.get('/', async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

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

    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM maintenance m
         JOIN vehicles v ON v.id = m.vehicle_id
         ${where}`,
        values
    );

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

maintenanceRouter.get('/:id', async (req, res) => {
    const record = await getMaintenance(req.params.id);

    res.json({ data: record });
});

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


import { Router } from 'express';
import { pool } from '../db/pool.js';
import { createError } from '../middleware/errors.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
    let result;

    try {
        result = await pool.query('SELECT NOW() AS db_time');
    } catch (err) {
        console.error('Health check: database unreachable:', err.message);

        throw createError(
            503,
            'DATABASE_UNAVAILABLE',
            'Server is running but cannot reach the database'
        );
    }

    res.json({
        data: {
            status: 'ok',
            database: 'connected',
            databaseTime: result.rows[0].db_time
        }
    });
});

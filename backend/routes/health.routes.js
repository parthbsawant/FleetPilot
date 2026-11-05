
// GET /api/health -> proves the server is up AND can reach the database.

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { createError } from '../middleware/errors.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
    let result;

    try {
        // pool.query is slow, so it returns a Promise; await waits for the answer.
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


// What we are doing: We are moving the existing /api/health 
// route out of server.js into a dedicated router file. We use 
// Express's Router() to create a mini application that manages
// related routes. Notice that the route path is now '/' 
// instead of '/api/health'; the complete URL will be assigned
// when we mount this router inside app.js in the next step. 
// The database query and error-handling logic remain unchanged.
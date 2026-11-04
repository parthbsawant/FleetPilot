import express from 'express';
import { config } from './config.js';
import { pool } from './db/pool.js';

import {
    createError,
    notFound,
    errorHandler
} from './middleware/error.js';

const app = express();

//Middleware 1 : Print every request in the terminal

app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});

//Middleware 2 : Convert JSON request bodies into req.body
app.use(express.json());

// app.get('/', (req, res) => {
//     res.send("Hello from Fleetpilot!!");
// });

app.get('/api/hello', (req, res) => {
    res.json({data : {message: 'Hello from the API', time: new Date()}});
});

// app.get('/api/missing', (req, res) => {
//     res.status(404).json(({
//         error : {
//             code : 'NOT_FOUND',
//             message : "Nothing lives here",
//             details : null 
//         }
//     }));
// });

//health api route - written after the db connect pool.js code

app.get('/api/health', async (req, res) => {
    let result;

    try {
        // Query the database and wait for its response.
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

// Unknown /api/... URLs get a JSON 404.
app.use('/api', notFound);

// Serve frontend files.
app.use(express.static('frontend'));

// No file matched either: 404.
app.use(notFound);

// Error handler: must be last.
app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`FleetPilot running at http://localhost:${config.port} (${config.env})`);
});


// What we are doing: We are upgrading the Express server to 
// use the error-handling middleware created in Step 1. The first 
// middleware logs every incoming request, and express.json() 
// parses JSON request bodies. The health endpoint now catches 
// database connection failures and throws a structured 503 
// DATABASE_UNAVAILABLE error. At the bottom, notFound handles 
// unmatched routes, while errorHandler handles errors and sends 
// consistent JSON responses. The error handler must remain last.

// What we are doing: We are telling Express to handle unknown 
// API URLs first and return JSON 404 responses. Next, 
// express.static('frontend') allows Express to serve files such 
// as index.html from the frontend folder. If no matching frontend 
// file exists either, the second notFound middleware returns a 404. 
// This ordering ensures API requests receive JSON errors 
// instead of accidentally receiving the frontend page.
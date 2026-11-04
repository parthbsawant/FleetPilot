import express from 'express';
import { config } from './config.js';
import { pool } from './db/pool.js'
const app = express();

app.get('/', (req, res) => {
    res.send("Hello from Fleetpilot!!");
});


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
    const result = await pool.query('SELECT NOW() AS db_time');

    res.json({
        data :{
            status: 'ok',
            database : 'connected',
            databaseTime: result.rows[0].db_time
        }
    });
});

app.listen(config.port, () => {
    console.log(`FleetPilot running at http://localhost:${config.port} (${config.env})`);
});
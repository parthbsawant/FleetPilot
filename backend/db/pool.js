
import pg from 'pg';
import {config, isProduction} from '../config.js';

pg.types.setTypeParser(1082, (text) => text);

const { Pool } = pg;

export const pool = new Pool({
    connectionString : config.databaseUrl,
    ssl: isProduction ? { rejectUnauthorized: false} : false
});

pool.on('error', (err) => {
    console.error('Unexpected database error', err.message);
});

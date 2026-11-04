//Why pool.js --> this is because we want one reusable data base 
//connection pool which can be imported wherever database access is required

import pg from 'pg';
import {config} from '..config.js';

const { Pool } = pg;

export const pool = new Pool({
    connectionString : config.databaseUrl
});
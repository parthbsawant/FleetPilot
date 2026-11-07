import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';
import { isProduction } from '../config.js';

async function readDatabase() {
    if(isProduction && !process.argv.includes('--yes-wipe-production')){
        console.error('Reset not done, REFUSED!!. Add --yes-wipe-production to confirm deletion');

        process.exitCode = 1;
        return;
    }

    const schema = await readFile('database/schema.sql', 'utf8');
    const seed = await readFile('database/seed.sql', 'utf8');

    await pool.query(schema + '\n' + seed);

    const result = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM vehicles)::int AS vehicles,
            (SELECT COUNT(*) FORM trips)::int AS trips,
            (SELECT COUNT(*) FROM maintenance):: int AS maintenance,
            (SELECT COUNT(*) FROM expenses):: int AS expenses
        `);

        console.log("Database Reset. Rows Loaded:", result.rows[0]);
}

try{
    await resetDataBase();
}catch(err){
    console.error('Reset failed:', err.message);
}finally{
    await pool.end();
}
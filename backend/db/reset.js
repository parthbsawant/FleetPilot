import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';
import { isProduction } from '../config.js';


async function resetDatabase() {
    if (isProduction && !process.argv.includes('--yes-wipe-production')) {
        console.error('Refusing to reset a production database. Add --yes-wipe-production if you really mean it.');
        process.exitCode = 1;
        return;
    }

    const schema = await readFile('database/schema.sql', 'utf8');
    const seed = await readFile('database/seed.sql', 'utf8');

    await pool.query(schema + '\n' + seed);

    const result = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM vehicles)::int AS vehicles,
            (SELECT COUNT(*) FROM trips)::int AS trips,
            (SELECT COUNT(*) FROM maintenance)::int AS maintenance,
            (SELECT COUNT(*) FROM expenses)::int AS expenses
    `);

    console.log('Database reset. Rows loaded:', result.rows[0]);
}


try {
    await resetDatabase();
} catch (err) {
    console.error('Reset failed:', err.message);
    process.exitCode = 1;
} finally {
    await pool.end(); 
}
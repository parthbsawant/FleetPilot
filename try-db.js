//This code for checking the database connection

import pg from 'pg';

const pool =  new pg.Pool({
    connectionString:process.env.DATABASE_URL
});

async function main(){
    const result = await pool.query(
        'SELECT NOW() AS db_time, 2 + 3 AS answer'
    );

    console.log(result.rows);

    console.log('The answer column is', result.rows[0].answer);

    await pool.end();
}

main();


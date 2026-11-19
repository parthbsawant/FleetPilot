import { Router } from 'express';
import { pool } from '../db/pool.js';

export const dashboardRouter = Router();

const ALLOWED_MONTHS = [1, 3, 6, 12]; 

dashboardRouter.get('/', async (req, res) => {

    const asked = Number(req.query.months);
    const months = ALLOWED_MONTHS.includes(asked) ? asked : 6;



    const periodResult = await pool.query(
        `SELECT
            (date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')::date)
                - ($1 - 1) * interval '1 month')::date::text AS start_date,
            (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS end_date`,
        [months]
    );

    const { start_date, end_date } = periodResult.rows[0];

    const fleetResult = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE status = 'active')::int AS active,
            COUNT(*) FILTER (WHERE status = 'in_maintenance')::int AS in_maintenance,
            COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive
         FROM vehicles`
    );

    const fleet = fleetResult.rows[0];

    fleet.total = fleet.active + fleet.in_maintenance;

    const tripsResult = await pool.query(
        `SELECT
            COUNT(*)::int AS completed,
            COALESCE(SUM(distance_km), 0)::int AS distance_km
         FROM trips
         WHERE status = 'completed'
           AND (end_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1 AND $2`,
        [start_date, end_date]
    );

    const trips = tripsResult.rows[0];

    const expenseTotalResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM expenses
         WHERE expense_date BETWEEN $1 AND $2`,
        [start_date, end_date]
    );

    const byCategoryResult = await pool.query(
        `SELECT category, SUM(amount) AS total
         FROM expenses
         WHERE expense_date BETWEEN $1 AND $2
         GROUP BY category
         ORDER BY SUM(amount) DESC`,
        [start_date, end_date]
    );

    const expenseTotal = expenseTotalResult.rows[0].total;

    const costPerKm = trips.distance_km > 0
        ? (Number(expenseTotal) / trips.distance_km).toFixed(2)
        : null;

    const monthlyResult = await pool.query(
        `SELECT
            to_char(m.month, 'YYYY-MM') AS month,
            COALESCE((
                SELECT SUM(t.distance_km)
                FROM trips t
                WHERE t.status = 'completed'
                  AND date_trunc('month', t.end_at AT TIME ZONE 'Asia/Kolkata') = m.month
            ), 0)::int AS distance_km,
            COALESCE((
                SELECT SUM(e.amount)
                FROM expenses e
                WHERE date_trunc('month', e.expense_date::timestamp) = m.month
            ), 0) AS expenses
         FROM generate_series($1::date, $2::date, interval '1 month') AS m(month)
         ORDER BY m.month`,
        [start_date, end_date]
    );


    res.json({
        data: {
            period: { months, start_date, end_date },
            fleet,
            trips,
            expenses: {
                total: expenseTotal,
                by_category: byCategoryResult.rows
            },
            cost_per_km: costPerKm,
            monthly: monthlyResult.rows
        }
    });
});

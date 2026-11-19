
// The dashboard route: ONE request that returns every number the dashboard shows.
// All numbers are calculated by PostgreSQL from the real records (decision D-07),
// never typed in by hand.

import { Router } from 'express';
import { pool } from '../db/pool.js';

export const dashboardRouter = Router();

// The periods the page can ask for: this month, last 3, 6 or 12 months
const ALLOWED_MONTHS = [1, 3, 6, 12];


// ---------- GET /api/dashboard?months=6 ----------

dashboardRouter.get('/', async (req, res) => {
    // Anything not in the list falls back to the default, 6 months
    const asked = Number(req.query.months);
    const months = ALLOWED_MONTHS.includes(asked) ? asked : 6;


    // 1. The period: from the 1st of the first month to today (India dates).
    //    months = 6 in November -> from 1 June to today.
    const periodResult = await pool.query(
        `SELECT
            (date_trunc('month', (now() AT TIME ZONE 'Asia/Kolkata')::date)
                - ($1 - 1) * interval '1 month')::date::text AS start_date,
            (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS end_date`,
        [months]
    );

    const { start_date, end_date } = periodResult.rows[0];


    // 2. The fleet right now (not affected by the period).
    //    COUNT(*) FILTER (WHERE ...) counts only the rows that match.
    const fleetResult = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE status = 'active')::int AS active,
            COUNT(*) FILTER (WHERE status = 'in_maintenance')::int AS in_maintenance,
            COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive
         FROM vehicles`
    );

    const fleet = fleetResult.rows[0];

    // D-07: the fleet total is active + in maintenance; inactive is shown apart
    fleet.total = fleet.active + fleet.in_maintenance;


    // 3. Completed trips in the period. A trip counts in the period that
    //    contains its END time (D-07), taken as an India date.
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


    // 4. Expenses in the period: one total, and one total per category
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


    // 5. Cost per km = expenses / completed distance. Never divide by 0 (D-07).
    const costPerKm = trips.distance_km > 0
        ? (Number(expenseTotal) / trips.distance_km).toFixed(2)
        : null;


    // 6. Month by month: distance and expenses for every month in the period.
    //    generate_series makes one row per month, even months with no data,
    //    and each subquery adds up that month's numbers.
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


// The expenses routes. Each route: read the request -> run SQL -> send the answer.
// Same idea as trips.routes.js: no separate validation file. The CHECK rules in
// schema.sql refuse bad expenses, and errors.js turns refusals into messages.
// One extra: the list also sends the TOTAL amount of all matching expenses.

import { Router } from 'express';
import { pool } from '../db/pool.js';
import { createError } from '../middleware/errors.js';

export const expensesRouter = Router();


// ---------- Small helpers ----------

// The columns every expense answer contains.
// amount is NUMERIC, which pg sends as text like "8624.50" (exact, no rounding).
const EXPENSE_COLUMNS = `
    e.id,
    e.vehicle_id,
    v.registration_number,
    e.expense_date,
    e.category,
    e.amount,
    e.description
`;

// An empty form field arrives as '' -> store it as NULL (no value)
function emptyToNull(value) {
    if (value === undefined || value === null) return null;

    const text = String(value).trim();

    return text === '' ? null : text;
}

// The 5 values for INSERT and UPDATE, in the same order as the columns
function expenseValues(body) {
    return [
        emptyToNull(body.vehicle_id),
        emptyToNull(body.expense_date),
        emptyToNull(body.category),
        emptyToNull(body.amount),
        emptyToNull(body.description)
    ];
}

// One expense by id, or a 404 error
async function getExpense(id) {
    const result = await pool.query(
        `SELECT ${EXPENSE_COLUMNS}
         FROM expenses e
         JOIN vehicles v ON v.id = e.vehicle_id
         WHERE e.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        throw createError(404, 'EXPENSE_NOT_FOUND', `Expense ${id} not found`);
    }

    return result.rows[0];
}


// ---------- GET /api/expenses?vehicle_id=3&category=fuel&from=...&to=...&search=diesel&page=1 ----------

expensesRouter.get('/', async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    // Build the WHERE from the filters that were sent (same idea as trips)
    const conditions = [];
    const values = [];

    if (req.query.vehicle_id) {
        values.push(req.query.vehicle_id);
        conditions.push(`e.vehicle_id = $${values.length}`);
    }

    if (req.query.category) {
        values.push(req.query.category);
        conditions.push(`e.category = $${values.length}`);
    }

    if (req.query.from) {
        values.push(req.query.from);
        conditions.push(`e.expense_date >= $${values.length}`);
    }

    if (req.query.to) {
        values.push(req.query.to);
        conditions.push(`e.expense_date <= $${values.length}`);
    }

    if (req.query.search) {
        values.push(`%${req.query.search}%`);
        conditions.push(`(
            e.description ILIKE $${values.length}
            OR v.registration_number ILIKE $${values.length}
        )`);
    }

    const where = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    // Query 1: how many expenses match, and their total amount.
    // COALESCE gives 0 instead of NULL when nothing matches.
    const totalsResult = await pool.query(
        `SELECT
            COUNT(*)::int AS total,
            COALESCE(SUM(e.amount), 0) AS total_amount
         FROM expenses e
         JOIN vehicles v ON v.id = e.vehicle_id
         ${where}`,
        values
    );

    // Query 2: one page of expenses, newest first
    const rowsResult = await pool.query(
        `SELECT ${EXPENSE_COLUMNS}
         FROM expenses e
         JOIN vehicles v ON v.id = e.vehicle_id
         ${where}
         ORDER BY e.expense_date DESC, e.id DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
    );

    res.json({
        data: rowsResult.rows,
        meta: {
            page,
            limit,
            total: totalsResult.rows[0].total,
            total_amount: totalsResult.rows[0].total_amount
        }
    });
});


// ---------- GET /api/expenses/7 ----------

expensesRouter.get('/:id', async (req, res) => {
    const expense = await getExpense(req.params.id);

    res.json({ data: expense });
});


// ---------- POST /api/expenses ----------

expensesRouter.post('/', async (req, res) => {
    const result = await pool.query(
        `INSERT INTO expenses
            (vehicle_id, expense_date, category, amount, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        expenseValues(req.body)
    );

    const expense = await getExpense(result.rows[0].id);

    res.status(201).json({ data: expense });
});


// ---------- PATCH /api/expenses/7 ----------
// The form always sends every field, so we simply update every column.

expensesRouter.patch('/:id', async (req, res) => {
    const result = await pool.query(
        `UPDATE expenses
         SET vehicle_id = $1,
             expense_date = $2,
             category = $3,
             amount = $4,
             description = $5,
             updated_at = now()
         WHERE id = $6
         RETURNING id`,
        [...expenseValues(req.body), req.params.id]
    );

    if (result.rows.length === 0) {
        throw createError(404, 'EXPENSE_NOT_FOUND', `Expense ${req.params.id} not found`);
    }

    const expense = await getExpense(req.params.id);

    res.json({ data: expense });
});


// ---------- DELETE /api/expenses/7 ----------

expensesRouter.delete('/:id', async (req, res) => {
    const result = await pool.query(
        'DELETE FROM expenses WHERE id = $1 RETURNING id',
        [req.params.id]
    );

    if (result.rows.length === 0) {
        throw createError(404, 'EXPENSE_NOT_FOUND', `Expense ${req.params.id} not found`);
    }

    res.json({ data: { id: Number(req.params.id), deleted: true } });
});

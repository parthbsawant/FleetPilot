
// The Dashboard page: summary cards, three charts and the service alerts.
// One request (GET /api/dashboard?months=6) brings every number;
// the alerts reuse the maintenance alerts route.
// Chart is a global from the Chart.js <script> tag in index.html.

import { api } from './api.js';

import {
    formatKm,
    formatDate,
    formatMoney,
    formatMonth,
    CATEGORY_LABELS,
    ALERT_LABELS,
    escapeHtml
} from './format.js';


// ---------- 1. Find the elements we work with ----------

const periodEl = document.getElementById('period');
const periodTextEl = document.getElementById('period-text');
const noticeEl = document.getElementById('notice');

const fleetEl = document.getElementById('kpi-fleet');
const fleetSubEl = document.getElementById('kpi-fleet-sub');
const tripsEl = document.getElementById('kpi-trips');
const tripsSubEl = document.getElementById('kpi-trips-sub');
const expensesEl = document.getElementById('kpi-expenses');
const expensesSubEl = document.getElementById('kpi-expenses-sub');
const costEl = document.getElementById('kpi-cost');

const alertsTitleEl = document.getElementById('alerts-title');
const alertRowsEl = document.getElementById('alert-rows');


// ---------- 2. Page state ----------

// The three charts currently drawn. We keep them so we can remove
// (destroy) the old chart before drawing a new one for another period.
let distanceChart = null;
let expensesChart = null;
let categoryChart = null;

// Brand colours (the same as in app.css)
const ORANGE = '#FF7138';
const TEAL = '#37A59A';
const CATEGORY_COLOURS = ['#FF7138', '#37A59A', '#202833', '#E8B53A', '#9CA3AF'];


// ---------- 3. Messages above the page ----------

function showNotice(message, kind) {
    noticeEl.textContent = message;
    noticeEl.className = `notice notice-${kind}`;
}

function hideNotice() {
    noticeEl.className = 'notice hidden';
}


// ---------- 4. The four summary cards ----------

const numberFormat = new Intl.NumberFormat('en-IN');

function showCards(data) {
    const { period, fleet, trips, expenses, cost_per_km } = data;

    periodTextEl.textContent = `${formatDate(period.start_date)} – ${formatDate(period.end_date)}`;

    // Fleet = active + in maintenance; inactive is shown separately (D-07)
    fleetEl.textContent = fleet.total;
    fleetSubEl.textContent =
        `${fleet.active} active · ${fleet.in_maintenance} in maintenance · ${fleet.inactive} inactive (not counted)`;

    tripsEl.textContent = numberFormat.format(trips.completed);
    tripsSubEl.textContent = `${formatKm(trips.distance_km)} driven`;

    expensesEl.textContent = formatMoney(expenses.total);
    expensesSubEl.textContent = expenses.by_category.length > 0
        ? `Largest: ${CATEGORY_LABELS[expenses.by_category[0].category]}`
        : 'No expenses in this period';

    // null means "no distance driven", so there is nothing to divide by
    costEl.textContent = cost_per_km === null ? '—' : formatMoney(cost_per_km);
}


// ---------- 5. The charts ----------

function drawCharts(data) {
    // Remove the old charts first, or Chart.js would draw on top of them
    if (distanceChart) distanceChart.destroy();
    if (expensesChart) expensesChart.destroy();
    if (categoryChart) categoryChart.destroy();

    // "2026-06" -> "Jun 2026" for the x-axis
    const monthLabels = data.monthly.map((m) => formatMonth(m.month));

    distanceChart = new Chart(document.getElementById('distance-chart'), {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: 'Distance (km)',
                data: data.monthly.map((m) => m.distance_km),
                backgroundColor: ORANGE
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    expensesChart = new Chart(document.getElementById('expenses-chart'), {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: 'Expenses (₹)',
                // amounts arrive as text like "308984.99" -> make them numbers
                data: data.monthly.map((m) => Number(m.expenses)),
                backgroundColor: TEAL
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    categoryChart = new Chart(document.getElementById('category-chart'), {
        type: 'doughnut',
        data: {
            labels: data.expenses.by_category.map((c) => CATEGORY_LABELS[c.category]),
            datasets: [{
                data: data.expenses.by_category.map((c) => Number(c.total)),
                backgroundColor: CATEGORY_COLOURS
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });
}


// ---------- 6. Service alerts (not affected by the period) ----------

function nextServiceText(alert) {
    const parts = [];

    if (alert.next_service_date) parts.push(formatDate(alert.next_service_date));

    if (alert.km_left !== null) {
        parts.push(alert.km_left > 0
            ? `${formatKm(alert.km_left)} left`
            : `${formatKm(-alert.km_left)} over`);
    }

    return parts.join(' · ');
}

async function loadAlerts() {
    try {
        const result = await api('/maintenance/alerts');

        const { overdue, due_soon } = result.meta;
        alertsTitleEl.textContent = `Service alerts: ${overdue} overdue, ${due_soon} due soon`;

        // Only the vehicles that need attention
        const urgent = result.data.filter((a) => a.state === 'overdue' || a.state === 'due_soon');

        if (urgent.length === 0) {
            alertRowsEl.innerHTML = `
                <tr><td class="message" colspan="3">No vehicle needs a service soon.</td></tr>
            `;
            return;
        }

        alertRowsEl.innerHTML = urgent.map((alert) => `
            <tr>
                <td><strong>${escapeHtml(alert.registration_number)}</strong></td>
                <td><span class="badge badge-${alert.state}">${ALERT_LABELS[alert.state]}</span></td>
                <td>${nextServiceText(alert)}</td>
            </tr>
        `).join('');
    } catch (err) {
        alertRowsEl.innerHTML = `
            <tr><td class="message" colspan="3">${escapeHtml(`Could not load alerts: ${err.message}`)}</td></tr>
        `;
    }
}


// ---------- 7. Load the dashboard for the chosen period ----------

async function loadDashboard() {
    hideNotice();

    try {
        const result = await api(`/dashboard?months=${periodEl.value}`);

        showCards(result.data);
        drawCharts(result.data);
    } catch (err) {
        showNotice(`Could not load the dashboard: ${err.message}`, 'error');
    }
}

// A new period -> load the numbers and charts again
periodEl.addEventListener('change', loadDashboard);


// ---------- 8. Start ----------

loadDashboard();
loadAlerts();

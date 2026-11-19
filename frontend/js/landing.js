

import { api } from './api.js';
import { formatKm, formatMoney } from './format.js';

const numberFormat = new Intl.NumberFormat('en-IN');

async function loadStats() {
    try {
        const result = await api('/dashboard?months=12');
        const { fleet, trips, cost_per_km } = result.data;

        document.getElementById('stat-vehicles').textContent = fleet.total;
        document.getElementById('stat-trips').textContent = numberFormat.format(trips.completed);
        document.getElementById('stat-distance').textContent = formatKm(trips.distance_km);
        document.getElementById('stat-cost').textContent =
            cost_per_km === null ? '—' : formatMoney(cost_per_km);
    } catch (err) {
        document.getElementById('stat-note').textContent = 'Live numbers are not available right now.';
    }
}

loadStats();

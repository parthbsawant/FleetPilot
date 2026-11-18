

import { api } from './api.js';

import {
    formatKm,
    formatDate,
    formatDateTime,
    TRIP_STATUS_LABELS,
    formatMoney,
    CATEGORY_LABELS,
    TYPE_LABELS,
    STATUS_LABELS,
    escapeHtml
} from './format.js';


// ---------- 1. Find the elements we work with ----------

const titleEl = document.getElementById('vehicle-title');
const noticeEl = document.getElementById('notice');
const detailsEl = document.getElementById('details');


// ---------- 2. Read the id from the address ----------

// location.search is the "?id=3" part of the address
const params = new URLSearchParams(location.search);
const vehicleId = params.get('id');


// ---------- 3. Messages above the page ----------

function showNotice(message, kind) {
    noticeEl.textContent = message;
    noticeEl.className = `notice notice-${kind}`;
}


// ---------- 4. Show the details ----------

// One label + value pair inside the details card
function detailHtml(label, value) {
    return `
        <div>
            <div class="details-label">${label}</div>
            <div class="details-value">${value}</div>
        </div>
    `;
}

function showVehicle(vehicle) {
    titleEl.textContent = vehicle.registration_number;
    document.title = `${vehicle.registration_number} · FleetPilot`;

    const status = `
        <span class="badge badge-${vehicle.status}">
            ${STATUS_LABELS[vehicle.status]}
        </span>
    `;

    detailsEl.innerHTML = [
        detailHtml('Name / model', escapeHtml(vehicle.name_model)),
        detailHtml('Type', TYPE_LABELS[vehicle.vehicle_type]),
        detailHtml('Status', status),
        detailHtml('Current odometer', formatKm(vehicle.current_odometer_km)),
        detailHtml('Odometer when added', formatKm(vehicle.initial_odometer_km)),
        detailHtml('Acquired on', formatDate(vehicle.acquired_on))
    ].join('');
}


// ---------- 5. Load the vehicle ----------

async function loadVehicle() {
    if (!vehicleId) {
        showNotice('No vehicle chosen. Go back and pick one from the list.', 'error');
        detailsEl.classList.add('hidden');
        return;
    }

    try {
        const result = await api(`/vehicles/${vehicleId}`);

        showVehicle(result.data);
    } catch (err) {
        showNotice(err.message, 'error');
        detailsEl.classList.add('hidden');
    }
}


// ---------- 6. This vehicle's recent trips ----------

const tripRowsEl = document.getElementById('trip-rows');

function tripRowHtml(trip) {
    return `
        <tr>
            <td>${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)}</td>
            <td class="nowrap">${formatDateTime(trip.start_at)}</td>
            <td class="num">${formatKm(trip.distance_km)}</td>
            <td>
                <span class="badge badge-${trip.status}">
                    ${TRIP_STATUS_LABELS[trip.status]}
                </span>
            </td>
        </tr>
    `;
}

async function loadRecentTrips() {
    try {
        // The normal trips list, filtered to this vehicle, newest 10
        const result = await api(`/trips?vehicle_id=${vehicleId}&limit=10`);

        if (result.data.length === 0) {
            tripRowsEl.innerHTML = `
                <tr><td class="message" colspan="4">No trips yet.</td></tr>
            `;
        } else {
            tripRowsEl.innerHTML = result.data.map(tripRowHtml).join('');
        }
    } catch (err) {
        tripRowsEl.innerHTML = `
            <tr><td class="message" colspan="4">${escapeHtml(`Could not load trips: ${err.message}`)}</td></tr>
        `;
    }
}


// ---------- 7. This vehicle's recent services ----------

const serviceRowsEl = document.getElementById('service-rows');

function serviceRowHtml(record) {
    // Next service: a date, a reading, both, or neither
    const nextParts = [];
    if (record.next_service_date) nextParts.push(formatDate(record.next_service_date));
    if (record.next_service_odometer_km !== null) nextParts.push(formatKm(record.next_service_odometer_km));

    return `
        <tr>
            <td class="nowrap">${formatDate(record.service_date)}</td>
            <td>${escapeHtml(record.service_type)}</td>
            <td class="num nowrap">${formatKm(record.odometer_km)}</td>
            <td>${nextParts.length > 0 ? nextParts.join(' or ') : '—'}</td>
        </tr>
    `;
}

async function loadRecentServices() {
    try {
        // The normal maintenance list, filtered to this vehicle, newest 5
        const result = await api(`/maintenance?vehicle_id=${vehicleId}&limit=5`);

        if (result.data.length === 0) {
            serviceRowsEl.innerHTML = `
                <tr><td class="message" colspan="4">No services yet.</td></tr>
            `;
        } else {
            serviceRowsEl.innerHTML = result.data.map(serviceRowHtml).join('');
        }
    } catch (err) {
        serviceRowsEl.innerHTML = `
            <tr><td class="message" colspan="4">${escapeHtml(`Could not load services: ${err.message}`)}</td></tr>
        `;
    }
}


// ---------- 8. This vehicle's recent expenses ----------

const expenseRowsEl = document.getElementById('expense-rows');
const expensesTitleEl = document.getElementById('expenses-title');

function expenseRowHtml(expense) {
    return `
        <tr>
            <td class="nowrap">${formatDate(expense.expense_date)}</td>
            <td>${CATEGORY_LABELS[expense.category]}</td>
            <td>${escapeHtml(expense.description ?? '—')}</td>
            <td class="num nowrap">${formatMoney(expense.amount)}</td>
        </tr>
    `;
}

async function loadRecentExpenses() {
    try {
        // The normal expenses list, filtered to this vehicle, newest 5
        const result = await api(`/expenses?vehicle_id=${vehicleId}&limit=5`);

        // The total covers ALL of this vehicle's expenses, not just these 5
        expensesTitleEl.textContent = `Recent expenses (total ${formatMoney(result.meta.total_amount)})`;

        if (result.data.length === 0) {
            expenseRowsEl.innerHTML = `
                <tr><td class="message" colspan="4">No expenses yet.</td></tr>
            `;
        } else {
            expenseRowsEl.innerHTML = result.data.map(expenseRowHtml).join('');
        }
    } catch (err) {
        expenseRowsEl.innerHTML = `
                            <tr><td class="message" colspan="4">${escapeHtml(`Could not load expenses: ${err.message}`)}</td></tr>
        `;
    }
}


// ---------- 9. Start ----------

loadVehicle();
loadRecentTrips();
loadRecentServices();
loadRecentExpenses();
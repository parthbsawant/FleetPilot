
// The Vehicle detail page: shows one vehicle.
// The address looks like /vehicle.html?id=3 and we read the 3 from it.

import { api } from './api.js';

import {
    formatKm,
    formatDate,
    formatDateTime,
    TRIP_STATUS_LABELS,
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
        // A wrong id gives the API's own message, e.g. "Vehicle not found"
        showNotice(err.message, 'error');
        detailsEl.classList.add('hidden');
    }
}


// ---------- 6. Start ----------

loadVehicle();
loadRecentTrips();
loadRecentServices();
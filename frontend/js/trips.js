// The Trips page: load the list, filter it, and add / edit / delete trips.
// Same structure as vehicles.js, section by section.

import { api } from './api.js';

import {
    formatKm,
    formatDateTime,
    TRIP_STATUS_LABELS,
    escapeHtml
} from './format.js';


// ---------- 1. Find the elements we work with ----------

const rowsEl = document.getElementById('trip-rows');
const noticeEl = document.getElementById('notice');

const searchEl = document.getElementById('search');
const vehicleFilterEl = document.getElementById('vehicle-filter');
const statusFilterEl = document.getElementById('status-filter');
const fromFilterEl = document.getElementById('from-filter');
const toFilterEl = document.getElementById('to-filter');

const pagerTextEl = document.getElementById('pager-text');
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');

const dialog = document.getElementById('trip-dialog');
const form = document.getElementById('trip-form');
const dialogTitle = document.getElementById('dialog-title');
const formErrorEl = document.getElementById('form-error');
const saveButton = document.getElementById('save-button');


// ---------- 2. Page state: everything that can change ----------

const PAGE_SIZE = 20;

let currentPage = 1;
let tripsOnPage = [];   // the trips currently shown
let editingId = null;   // null = adding; a number = editing that trip


// ---------- 3. Messages above the table ----------

function showNotice(message, kind) {
    noticeEl.textContent = message;
    noticeEl.className = `notice notice-${kind}`;
}

function hideNotice() {
    noticeEl.className = 'notice hidden';
}


// ---------- 4. Vehicle choices for the filter and the form ----------

async function loadVehicleOptions() {
    try {
        const result = await api('/vehicles?limit=100');

        const options = result.data.map((vehicle) => `
            <option value="${vehicle.id}">
                ${escapeHtml(vehicle.registration_number)} · ${escapeHtml(vehicle.name_model)}
            </option>
        `).join('');

        vehicleFilterEl.innerHTML = `<option value="">All vehicles</option>${options}`;
        form.elements.vehicle_id.innerHTML = `<option value="">Choose…</option>${options}`;
    } catch (err) {
        showNotice(`Could not load vehicles: ${err.message}`, 'error');
    }
}


// ---------- 5. Load and show the list ----------

function showMessageRow(text) {
    rowsEl.innerHTML = `
        <tr>
            <td class="message" colspan="7">${escapeHtml(text)}</td>
        </tr>
    `;
}

const numberFormat = new Intl.NumberFormat('en-IN');

// Distance with the readings under it, e.g. "127 km" / "40,663 → 40,790"
function distanceHtml(trip) {
    if (trip.distance_km !== null) {
        return `
            ${formatKm(trip.distance_km)}
            <div class="muted">${numberFormat.format(trip.start_odometer_km)} → ${numberFormat.format(trip.end_odometer_km)}</div>
        `;
    }

    if (trip.start_odometer_km !== null) {
        return `<div class="muted">from ${numberFormat.format(trip.start_odometer_km)}</div>`;
    }

    return '—';
}

function rowHtml(trip) {
    // Completed trips are history: they can be edited, not deleted
    const deleteButton = trip.status === 'completed'
        ? ''
        : `<button class="btn btn-small btn-danger" data-action="delete" data-id="${trip.id}">Delete</button>`;

    return `
        <tr>
            <td><strong>${escapeHtml(trip.registration_number)}</strong></td>
            <td>${escapeHtml(trip.origin)} → ${escapeHtml(trip.destination)}</td>
            <td>${formatDateTime(trip.start_at)}</td>
            <td>${formatDateTime(trip.end_at)}</td>
            <td class="num">${distanceHtml(trip)}</td>
            <td>
                <span class="badge badge-${trip.status}">
                    ${TRIP_STATUS_LABELS[trip.status]}
                </span>
            </td>
            <td class="actions">
                <button class="btn btn-small" data-action="edit" data-id="${trip.id}">Edit</button>
                ${deleteButton}
            </td>
        </tr>
    `;
}

async function loadTrips() {
    showMessageRow('Loading trips…');

    const params = new URLSearchParams({
        page: currentPage,
        limit: PAGE_SIZE
    });

    if (vehicleFilterEl.value) params.set('vehicle_id', vehicleFilterEl.value);
    if (statusFilterEl.value) params.set('status', statusFilterEl.value);
    if (fromFilterEl.value) params.set('from', fromFilterEl.value);
    if (toFilterEl.value) params.set('to', toFilterEl.value);
    if (searchEl.value.trim()) params.set('search', searchEl.value.trim());

    try {
        const result = await api(`/trips?${params}`);

        tripsOnPage = result.data;

        const { page, limit, total } = result.meta;

        if (tripsOnPage.length === 0) {
            showMessageRow('No trips match these filters.');
        } else {
            rowsEl.innerHTML = tripsOnPage.map(rowHtml).join('');
        }

        const first = total === 0 ? 0 : (page - 1) * limit + 1;
        const last = Math.min(page * limit, total);

        pagerTextEl.textContent = `Showing ${first}–${last} of ${total}`;

        prevButton.disabled = page <= 1;
        nextButton.disabled = last >= total;
    } catch (err) {
        showMessageRow(`Could not load trips: ${err.message}`);
        pagerTextEl.textContent = '';
    }
}


// ---------- 6. Filters, search and paging ----------

// Every dropdown and date filter works the same way: back to page 1, reload
for (const filterEl of [vehicleFilterEl, statusFilterEl, fromFilterEl, toFilterEl]) {
    filterEl.addEventListener('change', () => {
        currentPage = 1;
        loadTrips();
    });
}

// Search waits until typing pauses for 300 ms
let searchTimer;

searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        currentPage = 1;
        loadTrips();
    }, 300);
});

prevButton.addEventListener('click', () => {
    currentPage -= 1;
    loadTrips();
});

nextButton.addEventListener('click', () => {
    currentPage += 1;
    loadTrips();
});


// ---------- 7. The add / edit form ----------

// One message box at the top of the form (no per-field errors in this simple version)
function hideFormError() {
    formErrorEl.className = 'notice notice-error hidden';
}

function showFormError(message) {
    formErrorEl.textContent = message;
    formErrorEl.className = 'notice notice-error';
}

function openForm(trip) {
    form.reset();
    hideFormError();

    editingId = trip ? trip.id : null;
    dialogTitle.textContent = trip ? `Edit trip #${trip.id}` : 'Add trip';

    if (trip) {
        // Pre-fill every field. The API sends times as "YYYY-MM-DDTHH:mm",
        // exactly the text a datetime-local input expects.
        form.elements.vehicle_id.value = trip.vehicle_id;
        form.elements.status.value = trip.status;
        form.elements.origin.value = trip.origin;
        form.elements.destination.value = trip.destination;
        form.elements.start_at.value = trip.start_at;
        form.elements.end_at.value = trip.end_at ?? '';
        form.elements.start_odometer_km.value = trip.start_odometer_km ?? '';
        form.elements.end_odometer_km.value = trip.end_odometer_km ?? '';
        form.elements.notes.value = trip.notes ?? '';
    }

    dialog.showModal();
    form.elements.vehicle_id.focus();
}

document.getElementById('add-button').addEventListener('click', () => openForm(null));
document.getElementById('cancel-button').addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideFormError();

    const values = Object.fromEntries(new FormData(form));

    saveButton.disabled = true;

    try {
        if (editingId === null) {
            const result = await api('/trips', { method: 'POST', body: values });
            showNotice(`Trip #${result.data.id} added.`, 'success');
        } else {
            await api(`/trips/${editingId}`, { method: 'PATCH', body: values });
            showNotice(`Trip #${editingId} updated.`, 'success');
        }

        dialog.close();
        await loadTrips();
    } catch (err) {
        // e.g. "A completed trip needs both readings and an end time"
        showFormError(err.message);
    } finally {
        saveButton.disabled = false;
    }
});


// ---------- 8. Edit and delete buttons in the table ----------

rowsEl.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const id = Number(button.dataset.id);
    const trip = tripsOnPage.find((t) => t.id === id);

    if (button.dataset.action === 'edit') {
        openForm(trip);
        return;
    }

    if (button.dataset.action === 'delete') {
        const sure = confirm(`Delete trip #${id} (${trip.origin} → ${trip.destination})? This cannot be undone.`);
        if (!sure) return;

        try {
            await api(`/trips/${id}`, { method: 'DELETE' });
            showNotice(`Trip #${id} deleted.`, 'success');
            await loadTrips();
        } catch (err) {
            showNotice(err.message, 'error');
        }
    }
});


// ---------- 9. Start ----------

hideNotice();
loadVehicleOptions();
loadTrips();

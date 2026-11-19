
// The Vehicles page: load the list, filter it, and add / edit / delete vehicles.

import { api } from './api.js';

import {
    formatKm,
    formatDate,
    TYPE_LABELS,
    STATUS_LABELS,
    escapeHtml
} from './format.js';


// ---------- 1. Find the elements we work with ----------

const rowsEl = document.getElementById('vehicle-rows');
const noticeEl = document.getElementById('notice');

const searchEl = document.getElementById('search');
const statusFilterEl = document.getElementById('status-filter');
const typeFilterEl = document.getElementById('type-filter');

const pagerTextEl = document.getElementById('pager-text');
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');

const dialog = document.getElementById('vehicle-dialog');
const form = document.getElementById('vehicle-form');
const dialogTitle = document.getElementById('dialog-title');
const formErrorEl = document.getElementById('form-error');
const saveButton = document.getElementById('save-button');


// ---------- 2. Page state: everything that can change ----------

const PAGE_SIZE = 20;

let currentPage = 1;
let vehiclesOnPage = []; // The vehicles currently shown
let editingId = null;    // null = adding; a number = editing


// ---------- 3. Messages above the table ----------

function showNotice(message, kind) {
    noticeEl.textContent = message;
    noticeEl.className = `notice notice-${kind}`;
}

function hideNotice() {
    noticeEl.className = 'notice hidden';
}
// ---------- 4. Load and show the list ----------

function showMessageRow(text) {
    rowsEl.innerHTML = `
        <tr>
            <td class="message" colspan="7">
                ${escapeHtml(text)}
            </td>
        </tr>
    `;
}

function rowHtml(vehicle) {
    return `
        <tr>
            <td>

                <a class="row-link" href="/vehicle.html?id=${vehicle.id}">
                    <strong>${escapeHtml(vehicle.registration_number)}</strong>
                </a>
            </td>

            <td>${escapeHtml(vehicle.name_model)}</td>

            <td>${TYPE_LABELS[vehicle.vehicle_type]}</td>

            <td>
                <span class="badge badge-${vehicle.status}">
                    ${STATUS_LABELS[vehicle.status]}
                </span>
            </td>

            <td class="num">
                ${formatKm(vehicle.current_odometer_km)}
            </td>

            <td>${formatDate(vehicle.acquired_on)}</td>

            <td class="actions">
                <button
                    class="btn btn-small"
                    data-action="edit"
                    data-id="${vehicle.id}"
                >
                    Edit
                </button>

                <button
                    class="btn btn-small btn-danger"
                    data-action="delete"
                    data-id="${vehicle.id}"
                >
                    Delete
                </button>
            </td>
        </tr>
    `;
}


async function loadVehicles() {
    showMessageRow('Loading vehicles…');
    const params = new URLSearchParams({
        page: currentPage,
        limit: PAGE_SIZE
    });

    if (statusFilterEl.value) {
        params.set('status', statusFilterEl.value);
    }

    if (typeFilterEl.value) {
        params.set('type', typeFilterEl.value);
    }

    if (searchEl.value.trim()) {
        params.set('search', searchEl.value.trim());
    }

    try {
        const result = await api(`/vehicles?${params}`);

        vehiclesOnPage = result.data;

        const { page, limit, total } = result.meta;

        if (vehiclesOnPage.length === 0) {
            showMessageRow('No vehicles match these filters.');
        } else {
            rowsEl.innerHTML = vehiclesOnPage.map(rowHtml).join('');
        }

        const first = total === 0 ? 0 : (page - 1) * limit + 1;
        const last = Math.min(page * limit, total);

        pagerTextEl.textContent = `Showing ${first}–${last} of ${total}`;

        prevButton.disabled = page <= 1;
        nextButton.disabled = last >= total;

    } catch (err) {
        showMessageRow(`Could not load vehicles: ${err.message}`);

        pagerTextEl.textContent = '';
    }
}

statusFilterEl.addEventListener('change', () => {
    currentPage = 1;
    loadVehicles();
});

typeFilterEl.addEventListener('change', () => {
    currentPage = 1;
    loadVehicles();
});

let searchTimer;

searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        currentPage = 1;
        loadVehicles();
    }, 300);
});

prevButton.addEventListener('click', () => {
    currentPage -= 1;
    loadVehicles();
});

nextButton.addEventListener('click', () => {
    currentPage += 1;
    loadVehicles();
});

function clearFormErrors() {
    form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    formErrorEl.className = 'notice notice-error hidden';
}

function showFormErrors(details) {
    for (const [field, message] of Object.entries(details)) {
        const errorEl = form.querySelector(`[data-error-for="${field}"]`);
        if (errorEl) errorEl.textContent = message;
        form.elements[field]?.classList.add('invalid');
    }
}

function openForm(vehicle) {
    form.reset();
    clearFormErrors();
    editingId = vehicle ? vehicle.id : null;
    dialogTitle.textContent = vehicle ? `Edit ${vehicle.registration_number}` : 'Add vehicle';

    if (vehicle) {
        form.elements.registration_number.value = vehicle.registration_number;
        form.elements.name_model.value = vehicle.name_model;
        form.elements.vehicle_type.value = vehicle.vehicle_type;
        form.elements.status.value = vehicle.status;
        form.elements.initial_odometer_km.value = vehicle.initial_odometer_km;
        form.elements.acquired_on.value = vehicle.acquired_on ?? '';
    }
    dialog.showModal();
    form.elements.registration_number.focus();
}

document.getElementById('add-button').addEventListener('click', () => openForm(null));
document.getElementById('cancel-button').addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (event) => {
    event.preventDefault(); 
    clearFormErrors();
    const values = Object.fromEntries(new FormData(form));

    saveButton.disabled = true;
    try {
        if (editingId === null) {
            const result = await api('/vehicles', { method: 'POST', body: values });
            showNotice(`Vehicle ${result.data.registration_number} added.`, 'success');
        } else {
            await api(`/vehicles/${editingId}`, { method: 'PATCH', body: values });
            showNotice('Vehicle updated.', 'success');
        }
        dialog.close();
        await loadVehicles();
    } catch (err) {
        if (err.details) showFormErrors(err.details);
        formErrorEl.textContent = err.message;
        formErrorEl.className = 'notice notice-error';
    } finally {
        saveButton.disabled = false;
    }
});

rowsEl.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const id = Number(button.dataset.id);
    const vehicle = vehiclesOnPage.find((v) => v.id === id);

    if (button.dataset.action === 'edit') {
        openForm(vehicle);
        return;
    }

    if (button.dataset.action === 'delete') {
        const sure = confirm(`Delete ${vehicle.registration_number}? This cannot be undone.`);
        if (!sure) return;
        try {
            await api(`/vehicles/${id}`, { method: 'DELETE' });
            showNotice(`Vehicle ${vehicle.registration_number} deleted.`, 'success');
            await loadVehicles();
        } catch (err) {
            showNotice(err.message, 'error');
        }
    }
});

hideNotice();
loadVehicles();
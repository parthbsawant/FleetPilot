import { api } from './api.js';

import {
    formatKm,
    formatDate,
    ALERT_LABELS,
    escapeHtml
} from './format.js';


const noticeEl = document.getElementById('notice');

const alertRowsEl = document.getElementById('alert-rows');
const alertsTitleEl = document.getElementById('alerts-title');
const alertsOnlyEl = document.getElementById('alerts-only');

const rowsEl = document.getElementById('maintenance-rows');
const searchEl = document.getElementById('search');
const vehicleFilterEl = document.getElementById('vehicle-filter');
const fromFilterEl = document.getElementById('from-filter');
const toFilterEl = document.getElementById('to-filter');

const pagerTextEl = document.getElementById('pager-text');
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');

const dialog = document.getElementById('maintenance-dialog');
const form = document.getElementById('maintenance-form');
const dialogTitle = document.getElementById('dialog-title');
const formErrorEl = document.getElementById('form-error');
const saveButton = document.getElementById('save-button');

const PAGE_SIZE = 20;

let currentPage = 1;
let recordsOnPage = [];   
let allAlerts = [];       
let editingId = null;    



function showNotice(message, kind) {
    noticeEl.textContent = message;
    noticeEl.className = `notice notice-${kind}`;
}

function hideNotice() {
    noticeEl.className = 'notice hidden';
}



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



function daysText(days) {
    if (days === null) return '';
    if (days === 0) return 'today';
    if (days < 0) return `${-days} day${days === -1 ? '' : 's'} ago`;
    return `in ${days} day${days === 1 ? '' : 's'}`;
}

function kmText(km) {
    if (km === null) return '—';
    return km > 0 ? `${formatKm(km)} left` : `${formatKm(-km)} over`;
}

function alertRowHtml(alert) {
    const nextDate = alert.next_service_date
        ? `${formatDate(alert.next_service_date)} <div class="muted">${daysText(alert.days_left)}</div>`
        : '—';

    return `
        <tr>
            <td>
                <strong>${escapeHtml(alert.registration_number)}</strong>
                <div class="muted">${escapeHtml(alert.name_model)}</div>
            </td>
            <td><span class="badge badge-${alert.state}">${ALERT_LABELS[alert.state]}</span></td>
            <td>${nextDate}</td>
            <td class="num">${kmText(alert.km_left)}</td>
            <td>${formatDate(alert.last_service_date)}</td>
        </tr>
    `;
}

function renderAlerts() {
    const shown = alertsOnlyEl.checked
        ? allAlerts.filter((a) => a.state === 'overdue' || a.state === 'due_soon')
        : allAlerts;

    if (shown.length === 0) {
        alertRowsEl.innerHTML = `
            <tr><td class="message" colspan="5">No vehicle needs a service soon.</td></tr>
        `;
    } else {
        alertRowsEl.innerHTML = shown.map(alertRowHtml).join('');
    }
}

async function loadAlerts() {
    try {
        const result = await api('/maintenance/alerts');

        allAlerts = result.data;

        const { overdue, due_soon } = result.meta;
        alertsTitleEl.textContent = `Service alerts: ${overdue} overdue, ${due_soon} due soon`;

        renderAlerts();
    } catch (err) {
        alertRowsEl.innerHTML = `
            <tr><td class="message" colspan="5">${escapeHtml(`Could not load alerts: ${err.message}`)}</td></tr>
        `;
    }
}

alertsOnlyEl.addEventListener('change', renderAlerts);



function showMessageRow(text) {
    rowsEl.innerHTML = `
        <tr>
            <td class="message" colspan="6">${escapeHtml(text)}</td>
        </tr>
    `;
}

function rowHtml(record) {
    const nextParts = [];
    if (record.next_service_date) nextParts.push(formatDate(record.next_service_date));
    if (record.next_service_odometer_km !== null) nextParts.push(formatKm(record.next_service_odometer_km));

    const description = record.description
        ? `<div class="muted">${escapeHtml(record.description)}</div>`
        : '';

    return `
        <tr>
            <td class="nowrap">${formatDate(record.service_date)}</td>
            <td><strong>${escapeHtml(record.registration_number)}</strong></td>
            <td>${escapeHtml(record.service_type)}${description}</td>
            <td class="num nowrap">${formatKm(record.odometer_km)}</td>
            <td>${nextParts.length > 0 ? nextParts.join(' or ') : '—'}</td>
            <td class="actions">
                <button class="btn btn-small" data-action="edit" data-id="${record.id}">Edit</button>
                <button class="btn btn-small btn-danger" data-action="delete" data-id="${record.id}">Delete</button>
            </td>
        </tr>
    `;
}

async function loadRecords() {
    showMessageRow('Loading service history…');

    const params = new URLSearchParams({
        page: currentPage,
        limit: PAGE_SIZE
    });

    if (vehicleFilterEl.value) params.set('vehicle_id', vehicleFilterEl.value);
    if (fromFilterEl.value) params.set('from', fromFilterEl.value);
    if (toFilterEl.value) params.set('to', toFilterEl.value);
    if (searchEl.value.trim()) params.set('search', searchEl.value.trim());

    try {
        const result = await api(`/maintenance?${params}`);

        recordsOnPage = result.data;

        const { page, limit, total } = result.meta;

        if (recordsOnPage.length === 0) {
            showMessageRow('No services match these filters.');
        } else {
            rowsEl.innerHTML = recordsOnPage.map(rowHtml).join('');
        }

        const first = total === 0 ? 0 : (page - 1) * limit + 1;
        const last = Math.min(page * limit, total);

        pagerTextEl.textContent = `Showing ${first}–${last} of ${total}`;

        prevButton.disabled = page <= 1;
        nextButton.disabled = last >= total;
    } catch (err) {
        showMessageRow(`Could not load service history: ${err.message}`);
        pagerTextEl.textContent = '';
    }
}

for (const filterEl of [vehicleFilterEl, fromFilterEl, toFilterEl]) {
    filterEl.addEventListener('change', () => {
        currentPage = 1;
        loadRecords();
    });
}

let searchTimer;

searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        currentPage = 1;
        loadRecords();
    }, 300);
});

prevButton.addEventListener('click', () => {
    currentPage -= 1;
    loadRecords();
});

nextButton.addEventListener('click', () => {
    currentPage += 1;
    loadRecords();
});

function hideFormError() {
    formErrorEl.className = 'notice notice-error hidden';
}

function showFormError(message) {
    formErrorEl.textContent = message;
    formErrorEl.className = 'notice notice-error';
}

function todayText() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function openForm(record) {
    form.reset();
    hideFormError();

    editingId = record ? record.id : null;
    dialogTitle.textContent = record ? 'Edit service' : 'Add service';

    if (record) {
        form.elements.vehicle_id.value = record.vehicle_id;
        form.elements.service_date.value = record.service_date;
        form.elements.service_type.value = record.service_type;
        form.elements.odometer_km.value = record.odometer_km ?? '';
        form.elements.next_service_date.value = record.next_service_date ?? '';
        form.elements.next_service_odometer_km.value = record.next_service_odometer_km ?? '';
        form.elements.description.value = record.description ?? '';
    } else {
        form.elements.service_date.value = todayText();
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
            const result = await api('/maintenance', { method: 'POST', body: values });
            showNotice(`Service for ${result.data.registration_number} added.`, 'success');
        } else {
            await api(`/maintenance/${editingId}`, { method: 'PATCH', body: values });
            showNotice('Service updated.', 'success');
        }

        dialog.close();

        await Promise.all([loadRecords(), loadAlerts()]);
    } catch (err) {
        showFormError(err.message);
    } finally {
        saveButton.disabled = false;
    }
});

rowsEl.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const id = Number(button.dataset.id);
    const record = recordsOnPage.find((r) => r.id === id);

    if (button.dataset.action === 'edit') {
        openForm(record);
        return;
    }

    if (button.dataset.action === 'delete') {
        const sure = confirm(`Delete this ${record.service_type} for ${record.registration_number}? This cannot be undone.`);
        if (!sure) return;

        try {
            await api(`/maintenance/${id}`, { method: 'DELETE' });
            showNotice('Service deleted.', 'success');
            await Promise.all([loadRecords(), loadAlerts()]);
        } catch (err) {
            showNotice(err.message, 'error');
        }
    }
});


hideNotice();
loadVehicleOptions();
loadAlerts();
loadRecords();

import { api } from './api.js';

import {
    formatDate,
    formatMoney,
    CATEGORY_LABELS,
    escapeHtml
} from './format.js';


const rowsEl = document.getElementById('expense-rows');
const noticeEl = document.getElementById('notice');
const summaryEl = document.getElementById('summary');

const searchEl = document.getElementById('search');
const vehicleFilterEl = document.getElementById('vehicle-filter');
const categoryFilterEl = document.getElementById('category-filter');
const fromFilterEl = document.getElementById('from-filter');
const toFilterEl = document.getElementById('to-filter');

const pagerTextEl = document.getElementById('pager-text');
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');

const dialog = document.getElementById('expense-dialog');
const form = document.getElementById('expense-form');
const dialogTitle = document.getElementById('dialog-title');
const formErrorEl = document.getElementById('form-error');
const saveButton = document.getElementById('save-button');


const PAGE_SIZE = 20;

let currentPage = 1;
let expensesOnPage = [];  
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

function showMessageRow(text) {
    rowsEl.innerHTML = `
        <tr>
            <td class="message" colspan="6">${escapeHtml(text)}</td>
        </tr>
    `;
}

function rowHtml(expense) {
    return `
        <tr>
            <td class="nowrap">${formatDate(expense.expense_date)}</td>
            <td><strong>${escapeHtml(expense.registration_number)}</strong></td>
            <td>${CATEGORY_LABELS[expense.category]}</td>
            <td>${escapeHtml(expense.description ?? '—')}</td>
            <td class="num">${formatMoney(expense.amount)}</td>
            <td class="actions">
                <button class="btn btn-small" data-action="edit" data-id="${expense.id}">Edit</button>
                <button class="btn btn-small btn-danger" data-action="delete" data-id="${expense.id}">Delete</button>
            </td>
        </tr>
    `;
}

async function loadExpenses() {
    showMessageRow('Loading expenses…');

    const params = new URLSearchParams({
        page: currentPage,
        limit: PAGE_SIZE
    });

    if (vehicleFilterEl.value) params.set('vehicle_id', vehicleFilterEl.value);
    if (categoryFilterEl.value) params.set('category', categoryFilterEl.value);
    if (fromFilterEl.value) params.set('from', fromFilterEl.value);
    if (toFilterEl.value) params.set('to', toFilterEl.value);
    if (searchEl.value.trim()) params.set('search', searchEl.value.trim());

    try {
        const result = await api(`/expenses?${params}`);

        expensesOnPage = result.data;

        const { page, limit, total, total_amount } = result.meta;

        summaryEl.innerHTML = `Total for these filters: <strong>${formatMoney(total_amount)}</strong>`;

        if (expensesOnPage.length === 0) {
            showMessageRow('No expenses match these filters.');
        } else {
            rowsEl.innerHTML = expensesOnPage.map(rowHtml).join('');
        }

        const first = total === 0 ? 0 : (page - 1) * limit + 1;
        const last = Math.min(page * limit, total);

        pagerTextEl.textContent = `Showing ${first}–${last} of ${total}`;

        prevButton.disabled = page <= 1;
        nextButton.disabled = last >= total;
    } catch (err) {
        showMessageRow(`Could not load expenses: ${err.message}`);
        summaryEl.textContent = '';
        pagerTextEl.textContent = '';
    }
}


for (const filterEl of [vehicleFilterEl, categoryFilterEl, fromFilterEl, toFilterEl]) {
    filterEl.addEventListener('change', () => {
        currentPage = 1;
        loadExpenses();
    });
}

let searchTimer;

searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        currentPage = 1;
        loadExpenses();
    }, 300);
});

prevButton.addEventListener('click', () => {
    currentPage -= 1;
    loadExpenses();
});

nextButton.addEventListener('click', () => {
    currentPage += 1;
    loadExpenses();
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

function openForm(expense) {
    form.reset();
    hideFormError();

    editingId = expense ? expense.id : null;
    dialogTitle.textContent = expense ? 'Edit expense' : 'Add expense';

    if (expense) {
        form.elements.vehicle_id.value = expense.vehicle_id;
        form.elements.expense_date.value = expense.expense_date;
        form.elements.category.value = expense.category;
        form.elements.amount.value = expense.amount;
        form.elements.description.value = expense.description ?? '';
    } else {
        form.elements.expense_date.value = todayText();
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
            const result = await api('/expenses', { method: 'POST', body: values });
            showNotice(`Expense of ${formatMoney(result.data.amount)} added.`, 'success');
        } else {
            await api(`/expenses/${editingId}`, { method: 'PATCH', body: values });
            showNotice('Expense updated.', 'success');
        }

        dialog.close();
        await loadExpenses();
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
    const expense = expensesOnPage.find((e) => e.id === id);

    if (button.dataset.action === 'edit') {
        openForm(expense);
        return;
    }

    if (button.dataset.action === 'delete') {
        const sure = confirm(`Delete this ${formatMoney(expense.amount)} expense? This cannot be undone.`);
        if (!sure) return;

        try {
            await api(`/expenses/${id}`, { method: 'DELETE' });
            showNotice('Expense deleted.', 'success');
            await loadExpenses();
        } catch (err) {
            showNotice(err.message, 'error');
        }
    }
});


hideNotice();
loadVehicleOptions();
loadExpenses();

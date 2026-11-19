

const numberFormat = new Intl.NumberFormat('en-IN');

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];


export function formatKm(km) {
    return km === null || km === undefined
        ? '—'
        : `${numberFormat.format(km)} km`;
}

export function formatDate(text) {
    if (!text) return '—';

    const [year, month, day] = text.split('-');

    return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

export const TYPE_LABELS = {
    bus: 'Bus',
    coach: 'Coach',
    minibus: 'Minibus',
    van: 'Van',
    other: 'Other'
};

export const STATUS_LABELS = {
    active: 'Active',
    in_maintenance: 'In maintenance',
    inactive: 'Inactive'
};

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}



export function formatDateTime(text) {
    if (!text) return '—';

    const [date, time] = text.split('T');

    return `${formatDate(date)}, ${time}`;
}

export const TRIP_STATUS_LABELS = {
    scheduled: 'Scheduled',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Cancelled'
};


export const ALERT_LABELS = {
    overdue: 'Overdue',
    due_soon: 'Due soon',
    ok: 'OK',
    no_schedule: 'No schedule'
};


const moneyFormat = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
});

export function formatMoney(amount) {
    return amount === null || amount === undefined
        ? '—'
        : moneyFormat.format(Number(amount));
}

export const CATEGORY_LABELS = {
    fuel: 'Fuel',
    maintenance: 'Maintenance',
    tolls_parking: 'Tolls & parking',
    insurance_permits: 'Insurance & permits',
    other: 'Other'
};

export function formatMonth(text) {
    const [year, month] = text.split('-');

    return `${MONTHS[Number(month) - 1]} ${year}`;
}

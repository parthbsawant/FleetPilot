
function buildWhere(filters) {
    const conditions = [];
    const values = [];

    if (filters.status) {
        values.push(filters.status);
        conditions.push(`status = $${values.length}`);
    }

    if (filters.type) {
        values.push(filters.type);
        conditions.push(`vehicle_type = $${values.length}`);
    }

    if (filters.search) {
        values.push(`%${filters.search}%`);
        conditions.push(`name_model ILIKE $${values.length}`);
    }

    const where = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    return { where, values };
}

console.log(buildWhere({}));
console.log(buildWhere({ status: 'active' }));
console.log(buildWhere({
    status: 'active',
    type: 'bus',
    search: 'tata'
}));

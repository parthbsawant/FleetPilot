import {createError} from '../middleware/errors.js';

export const VEHICLE_TYPES = [
    'bus',
    'coach',
    'minibus',
    'van',
    'other'
];

export const VEHICLE_STATUSES = [
    'active',
    'in_maintenance',
    'inactive'
];

//parser for the req.params and req.query
export function parseId(text) {
    const id = Number(text);

    if(!Number.isInteger(id) || id < 1){
        throw createError(400, 'INVALID_ID', `"${text}" is not a valid id`);
    }

    return id;
}

//helper function for checking the date format & if the date is valid (not exported)
export function isRealDate(text){
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return false;
    }

    const date = new Date(`${text}T00:00:00Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

// to check if the date is valid date in INDIA
export function todayInIndia(){
    return new Intl.DateTimeFormat('en-CA',{
        timeZone : 'Asia/Kolkata'
    }).format(new Date());
}

export function validateVehicle(body, { isNew }){
    const input = body ?? {};
    const values = {};
    const errors = {};

    const has = (field) => input[field] !== undefined;

    // registration_number check
    if (has('registration_number') || isNew) {
        const reg = String(input.registration_number ?? '')
            .toUpperCase()
            .replace(/\s+/g, '');

        if (reg === '') {
            errors.registration_number = 'Registration number is required';
        } else if (!/^[A-Z0-9]{4,15}$/.test(reg)) {
            errors.registration_number = 'Use 4 to 15 letters and digits only';
        } else {
            values.registration_number = reg;
        }
    }

    //vehicle name model check
    if(has('name_model') || isNew){
        const name = String(input.name_model ?? '').trim();

        if(name === ''){
            errors.name_model = 'Name / model is required';
        } else if (name.length > 100){
            errors.name_model = 'Keep it under 100 characters';
        } else{
            values.name_model = name;
        }
    }
    //vehicle type check (should be between the predefined list)
    if(has('vehicle_type') || isNew){
        if(!VEHICLE_TYPES.includes(input.vehicle_type)){
            errors.vehicle_type = 'Choose a vehicle type';
        } else{
            values.vehicle_type= input.vehicle_type;
        }
    }

    // status: optional to create and database default = 'active'
    if (has('status')) {
        if (!VEHICLE_STATUSES.includes(input.status)) {
            errors.status = 'Choose a valid status';
        } else {
            values.status = input.status;
        }
    }

    //check and validate the odometer reading
    if (has('initial_odometer_km') && input.initial_odometer_km !== ''){
        const km = Number(input.initial_odometer_km);

        if(!Number.isInteger(km) || km < 0 || km > 9999999){
            errors.initial_odometer_km = 'Enter whole kilometres, 0 or more';
        } else {
            values.initial_odometer_km = km;
        }
    }

    //check the date of acquiring
    if(has('acquired_on')) {
        const date = input.acquired_on;

        if(date === null || date === ''){
            values.acquired_on = null;
        } else if(typeof date !== 'string' || !isRealDate(date)){
            errors.acquired_on = 'Use a real date (YYYY-MM-DD)';
        } else if (date > todayInIndia()) {
            errors.acquired_on = 'Cannot be in the future';
        } else {
            values.acquired_on = date;
        }
    }

    if (!isNew && Object.keys(values).length === 0 && Object.keys(errors).length === 0) {
        throw createError(400, 'NOTHING_TO_UPDATE', 'Send at least one field to change');
    }

    if (Object.keys(errors).length > 0) {
        throw createError(400, 'VALIDATION_ERROR', 'Some fields need fixing', errors);
    }

    return values;
}

export function validateVehicleQuery(query){
    const errors = {};
    const filters = {};

    if (query.status) {
        if (!VEHICLE_STATUSES.includes(query.status)) {
            errors.status = 'Unknown status';
        } else {
            filters.status = query.status;
        }
    }

    if(query.type){
        if(!VEHICLE_TYPES.includes(query.type)){
            errors.type = 'Unknown vehicle type';
        } else {
            filters.type = query.type;
        }
    }

    if(query.search && String(query.search).trim() !== ''){
        filters.search = String(query.search).trim();
    }

    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    if(!Number.isInteger(page) || page < 1){
        errors.page = 'Page must be 1 or more';
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        errors.limit = 'Limit must be between 1 and 100';
    }

    if (Object.keys(errors).length > 0) {
        throw createError(400, 'VALIDATION_ERROR', 'Invalid filters', errors);
    }

    return { filters, page, limit };
}
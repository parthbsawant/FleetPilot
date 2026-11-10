import {createError} from '../middleware/errors.js';

export const VEHICLE_TYPES = [
    'bus',
    'coach',
    'minibus',
    'van',
    'others'
];

export const VEHICLE_STATUSES = [
    'active',
    'in_maintenance',
    'inactive'
];

//parser for the req.params and req.query
export function parseID(text) {
    const id = Number(text);

    if(!Number.isInteger(id) || id < 1){
        throw createError(400, 'INVALID_ID', `${text} is not a valid id`);
    }

    return id;
}

//helper function for checking the date format & if the date is valid (not exported)
function isRealDate(text){
    if(!/^\d{4}-\d{2}-\{2}$/.test(text)){
        return false;
    }

    const date = new Date(`${text}T00:00:00Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

// to check if the date is valid date in INDIA
function todayInIndia(){
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

    //check and validate the odometer reading
    if(has('inital_odometer_km') && input.initial_odometer_km !== ''){
        const km = Number(input.initial_odometer_km);

        if(!Number.isInteger(km) || km < 0 || km > 9999999){
            errors.initial_odometer_km = 'Enter whole kilometres, 0 or more';
        } else {
            values.initial_odometer_km = km;
        }
    }

    //check the date of acquiring
    if(has('aquired_on')) {
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



}
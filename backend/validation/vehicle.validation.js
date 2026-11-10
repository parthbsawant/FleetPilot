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


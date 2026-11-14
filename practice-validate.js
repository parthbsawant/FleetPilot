
// practice-validate.js: try the validator without a server or a database

import {
    validateVehicle,
    parseId
} from './backend/validation/vehicles.validation.js';

function tryIt(label, work) {
    try {
        console.log(label, '->', work());
    } catch (err) {
        console.log(
            label,
            '->',
            err.status,
            err.code,
            err.details ?? err.message
        );
    }
}

tryIt('messy but valid', () => validateVehicle(
    {
        registration_number: ' mh 12 fp 0007 ',
        name_model: '          Tata Ultra ',
        vehicle_type: 'minibus'
    },
    { isNew: true },
));

tryIt('empty new vehicle', () => validateVehicle(
    {},
    { isNew: true }
));

tryIt('bad values', () => validateVehicle(
    {
        registration_number: 'MH12FP0008',
        name_model: 'X',
        vehicle_type: 'truck',
        initial_odometer_km: -4,
        acquired_on: '2025-02-30'
    },
    { isNew: true },
));

tryIt('edit one field', () => validateVehicle(
    { status: 'inactive' },
    { isNew: false }
));

tryIt('edit nothing', () => validateVehicle(
    {},
    { isNew: false }
));

tryIt('id "7"', () => parseId('7'));

tryIt('id "abc"', () => parseId('abc'));

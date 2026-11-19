
export function createError(status, code, message, details = null) {
    const error = new Error(message);

    error.status = status;
    error.code = code;
    error.details = details;
    error.isAppError = true;

    return error;
}


export function notFound(req, res, next) {
    next(
        createError(
            404,
            'NOT_FOUND',
            `No route for ${req.method} ${req.originalUrl}`
        )
    );
}


const CONSTRAINT_MESSAGES = {
    one_in_progress_trip_per_vehicle: 'This vehicle already has a trip in progress',
    trips_vehicle_id_fkey: 'Choose a vehicle that exists',
    odometers_not_negative: 'Odometer readings cannot be negative',
    end_odometer_needs_start: 'Enter the start reading too',
    end_odometer_after_start: 'The end reading must be at least the start reading',
    end_time_after_start: 'The end time must be after the start time',
    in_progress_needs_start_odometer: 'A trip in progress needs a start reading',
    completed_needs_readings_and_end_time: 'A completed trip needs both readings and an end time',
    valid_trip_status: 'Choose a valid status',
    maintenance_vehicle_id_fkey: 'Choose a vehicle that exists',
    service_type_not_blank: 'Enter the service type',
    maintenance_odometer_not_negative: 'The odometer reading cannot be negative',
    next_service_date_after_service: 'The next service date must be after the service date',
    next_service_odometer_after_reading: 'The next service km must be more than the odometer reading',
    expenses_vehicle_id_fkey: 'Choose a vehicle that exists',
    valid_expense_category: 'Choose a valid category',
    amount_in_range: 'The amount must be more than 0 and at most ₹10,00,000',
    linked_expense_is_maintenance: 'This expense came from a maintenance record, so its category must stay Maintenance',
};

const DATABASE_CODE_MESSAGES = {
    '23502': [400, 'Please fill in all required fields'],
    '23514': [400, 'Some values do not make sense together'],
    '23503': [400, 'A linked record does not exist'],
    '23505': [409, 'This would create a duplicate'],
    '22P02': [400, 'Some values are not in the right format'],
    '22007': [400, 'Some dates are not in the right format'],
    '22008': [400, 'Some dates are not real dates'],
    '22003': [400, 'A number is too large']
};

function fromDatabaseError(err) {
    const [status, message] = DATABASE_CODE_MESSAGES[err.code];

    return createError(
        status,
        'DATABASE_REFUSED',
        CONSTRAINT_MESSAGES[err.constraint] ?? message
    );
}

export function errorHandler(err, req, res, next) {

    if (err.type === 'entity.parse.failed') {
        err = createError(
            400,
            'INVALID_JSON',
            'Request body is not valid JSON'
        );
    }
    
    if (DATABASE_CODE_MESSAGES[err.code]) {
        err = fromDatabaseError(err);
    }
    
    if (err.isAppError) {
        res.status(err.status).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details
            }
        });

        return;
    }

    console.error(err);

    res.status(500).json({
        error: {
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong on the server',
            details: null
        }
    });
}

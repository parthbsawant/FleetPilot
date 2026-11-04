// Creates an Error that also carries an HTTP status and an error code.
// Example: throw createError(404, 'NOT_FOUND', 'Vehicle not found');

export function createError(status, code, message, details = null) {
    const error = new Error(message);

    error.status = status;
    error.code = code;
    error.details = details;
    error.isAppError = true;

    return error;
}


// Runs when no route matched the request.
export function notFound(req, res, next) {
    next(
        createError(
            404,
            'NOT_FOUND',
            `No route for ${req.method} ${req.originalUrl}`
        )
    );
}


// The last stop for every error.
export function errorHandler(err, req, res, next) {

    // Handle invalid JSON request bodies.
    if (err.type === 'entity.parse.failed') {
        err = createError(
            400,
            'INVALID_JSON',
            'Request body is not valid JSON'
        );
    }

    // Handle errors created intentionally by our application.
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

    // Unexpected errors: show details in terminal.
    console.error(err);

    res.status(500).json({
        error: {
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong on the server',
            details: null
        }
    });
}

// What we are doing: We are creating three reusable functions.
// createError() creates structured errors containing an HTTP 
// status, error code and message.notFound() handles requests 
// for URLs that do not exist by forwarding a 404 error.errorHandler() 
// catches errors passed through Express middleware and sends a consistent
// JSON response to the client.It also distinguishes errors deliberately 
// created by our application from unexpected server errors.
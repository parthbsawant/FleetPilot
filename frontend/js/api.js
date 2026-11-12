
// One function every page uses to talk to the FleetPilot API.
// It sends JSON, reads JSON, and turns { error } responses into thrown errors,
// so pages can use a normal try/catch.

export async function api(path, { method = 'GET', body } = {}) {
    let response;

    try {
        response = await fetch(`/api${path}`, {
            method,
            headers: body === undefined
                ? {}
                : { 'Content-Type': 'application/json' },
            body: body === undefined
                ? undefined
                : JSON.stringify(body),
        });
    } catch {
        // fetch itself only fails when the server can't be reached at all
        throw new Error('Cannot reach the server. Is it running?');
    }

    const result = await response.json();

    if (!response.ok) {
        const error = new Error(
            result.error?.message ?? `Request failed (${response.status})`
        );

        error.status = response.status;
        error.code = result.error?.code;
        error.details = result.error?.details ?? null;

        throw error;
    }

    return result; // { data, meta }
}

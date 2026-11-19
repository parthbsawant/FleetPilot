
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

    return result; 
}

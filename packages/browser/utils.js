export function showStep1(elements) {
    elements.step1.style.display = 'block';
    elements.step2.style.display = 'none';
    elements.step3.style.display = 'none';
}

export function showStep2(elements) {
    elements.step1.style.display = 'none';
    elements.step2.style.display = 'block';
    elements.step3.style.display = 'none';
}

export function showConnectedState(elements, streamId) {
    elements.step1.style.display = 'none';
    elements.step2.style.display = 'none';
    elements.step3.style.display = 'block';
    elements.connectedInfo.textContent = 'Stream ID: ' + streamId;
}

export async function mcpRequest(baseUrl, endpointPath, params = {}, method = 'POST') {
    let endpoint = `${baseUrl}/api/${endpointPath}`;
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
    };

    if (method === 'GET') {
        const searchParams = new URLSearchParams(params);
        endpoint += `?${searchParams.toString()}`;
    } else {
        options.body = JSON.stringify(params);
    }

    const response = await fetch(endpoint, options);
    if (!response.ok) throw new Error('Server request failed');
    return await response.json();
}

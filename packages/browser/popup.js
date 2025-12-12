document.addEventListener('DOMContentLoaded', () => {
    const serverUrlInput = document.getElementById('serverUrl');
    const nextBtn = document.getElementById('nextBtn');

    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    const projectSelect = document.getElementById('projectSelect');
    const streamSelect = document.getElementById('streamSelect');

    const newStreamSection = document.getElementById('newStreamSection');
    const newStreamName = document.getElementById('newStreamName');
    const createStreamBtn = document.getElementById('createStreamBtn');

    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const connectedInfo = document.getElementById('connectedInfo');
    const statusDiv = document.getElementById('status');

    // Check connection state on load
    chrome.storage.local.get(['serverUrl', 'streamId', 'enabled'], (result) => {
        if (result.serverUrl) {
            serverUrlInput.value = result.serverUrl;
        } else {
            serverUrlInput.value = "http://localhost:4567";
        }

        if (result.enabled && result.streamId && result.serverUrl) {
            showConnectedState(result.streamId);
        } else {
            showStep1();
        }
    });

    function showStep1() {
        step1.style.display = 'block';
        step2.style.display = 'none';
        step3.style.display = 'none';
    }

    function showStep2() {
        step1.style.display = 'none';
        step2.style.display = 'block';
        step3.style.display = 'none';
    }

    function showConnectedState(streamId) {
        step1.style.display = 'none';
        step2.style.display = 'none';
        step3.style.display = 'block';
        connectedInfo.textContent = 'Stream ID: ' + streamId;
    }

    async function mcpRequest(endpointPath, params = {}, method = 'POST') {
        const url = serverUrlInput.value;
        let endpoint = `${url}/api/${endpointPath}`;

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

    nextBtn.addEventListener('click', async () => {
        statusDiv.textContent = 'Connecting...';
        try {
            const projects = await mcpRequest('projects', {}, 'GET');
            statusDiv.textContent = '';
            showStep2();

            projectSelect.innerHTML = '<option value="" disabled selected>Select a Project</option>';
            projects.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                projectSelect.appendChild(opt);
            });

        } catch (e) {
            statusDiv.textContent = 'Error: ' + e.message;
        }
    });

    projectSelect.addEventListener('change', async () => {
        const projectId = projectSelect.value;
        streamSelect.innerHTML = '<option value="" disabled selected>Loading...</option>';
        try {
            const streams = await mcpRequest('streams', { projectId }, 'GET');

            streamSelect.innerHTML = '<option value="" disabled selected>Select a Browser Stream</option><option value="new">-- Create New Stream --</option>';

            // Filter only browser streams
            const browserStreams = streams.filter(s => s.type === 'browser');

            browserStreams.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                streamSelect.appendChild(opt);
            });

        } catch (e) {
            statusDiv.textContent = 'Error loading streams: ' + e.message;
        }
    });

    streamSelect.addEventListener('change', () => {
        if (streamSelect.value === 'new') {
            newStreamSection.style.display = 'block';
            connectBtn.style.display = 'none';
        } else {
            newStreamSection.style.display = 'none';
            connectBtn.style.display = 'block';
        }
    });

    createStreamBtn.addEventListener('click', async () => {
        const name = newStreamName.value;
        const projectId = projectSelect.value;
        if (!name || !projectId) return;

        statusDiv.textContent = 'Creating stream...';
        try {
            const newStream = await mcpRequest('streams/create', {
                projectId,
                name,
                type: 'browser'
            });

            const opt = document.createElement('option');
            opt.value = newStream.id;
            opt.textContent = newStream.name;
            if (newStream.token) {
                opt.dataset.token = newStream.token;
            }

            streamSelect.insertBefore(opt, streamSelect.lastElementChild);
            streamSelect.value = newStream.id;

            newStreamSection.style.display = 'none';
            connectBtn.style.display = 'block';
            statusDiv.textContent = 'Stream created!';

        } catch (e) {
            statusDiv.textContent = 'Error creating stream: ' + e.message;
        }
    });

    connectBtn.addEventListener('click', async () => {
        const streamId = streamSelect.value;
        if (!streamId || streamId === 'new') return;

        statusDiv.textContent = 'Connecting...';

        let token = null;
        const selectedOption = streamSelect.options[streamSelect.selectedIndex];

        // If we have a token in the dataset (newly created), use it.
        // Otherwise, fetch a new one from the server.
        if (selectedOption.dataset.token) {
            token = selectedOption.dataset.token;
        } else {
            try {
                const resp = await mcpRequest(`streams/${streamId}/token`, {}, 'GET');
                if (resp && resp.token) {
                    token = resp.token;
                }
            } catch (e) {
                statusDiv.textContent = 'Error getting token: ' + e.message;
                return;
            }
        }

        const config = {
            serverUrl: serverUrlInput.value,
            streamId: streamId,
            enabled: true
        };

        if (token) {
            config.token = token;
        }

        chrome.storage.local.set(config, () => {
            showConnectedState(streamId);
            statusDiv.textContent = 'Connected! Reload page to start.';
            setTimeout(() => statusDiv.textContent = '', 3000);
        });
    });

    disconnectBtn.addEventListener('click', () => {
        chrome.storage.local.set({ enabled: false }, () => {
            showStep1();
            statusDiv.textContent = 'Disconnected.';
        });
    });
});

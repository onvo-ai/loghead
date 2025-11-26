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

    async function mcpRequest(method, params = {}) {
        const url = serverUrlInput.value;
        const endpoint = `${url}/api/${method}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        if (!response.ok) throw new Error('Server request failed');
        return await response.json();
    }

    nextBtn.addEventListener('click', async () => {
        statusDiv.textContent = 'Connecting...';
        try {
            const projects = await mcpRequest('projects', {});
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
            const streams = await mcpRequest('streams', { projectId });

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

            streamSelect.insertBefore(opt, streamSelect.lastElementChild);
            streamSelect.value = newStream.id;

            newStreamSection.style.display = 'none';
            connectBtn.style.display = 'block';
            statusDiv.textContent = 'Stream created!';

        } catch (e) {
            statusDiv.textContent = 'Error creating stream: ' + e.message;
        }
    });

    connectBtn.addEventListener('click', () => {
        const streamId = streamSelect.value;
        if (!streamId || streamId === 'new') return;

        const config = {
            serverUrl: serverUrlInput.value,
            streamId: streamId,
            enabled: true
        };

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

import { showStep1, showStep2, showConnectedState, mcpRequest } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const serverUrlInput = document.getElementById('serverUrl');
    const nextBtn = document.getElementById('nextBtn');

    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const connectedInfo = document.getElementById('connectedInfo');
    const statusDiv = document.getElementById('status');

    // Group UI elements for helper functions
    const uiElements = { step1, step2, step3, connectedInfo };

    const projectSelect = document.getElementById('projectSelect');
    const streamSelect = document.getElementById('streamSelect');

    const newStreamSection = document.getElementById('newStreamSection');
    const newStreamName = document.getElementById('newStreamName');
    const createStreamBtn = document.getElementById('createStreamBtn');

    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');

    // Get current tab to scope configuration
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        const tabId = currentTab.id;
        const configKey = `config_${tabId}`;

        // Initial Load
        chrome.storage.local.get(['serverUrl', configKey], (result) => {
            if (result.serverUrl) {
                serverUrlInput.value = result.serverUrl;
            } else {
                serverUrlInput.value = "http://localhost:4567";
            }

            const tabConfig = result[configKey];
            if (tabConfig && tabConfig.enabled && tabConfig.streamId && tabConfig.serverUrl) {
                showConnectedState(uiElements, tabConfig.streamId);
            } else {
                showStep1(uiElements);
            }
        });

        // Event Listeners

        nextBtn.addEventListener('click', async () => {
            statusDiv.textContent = 'Connecting...';
            try {
                const projects = await mcpRequest(serverUrlInput.value, 'projects', {}, 'GET');
                statusDiv.textContent = '';
                showStep2(uiElements);

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
                const streams = await mcpRequest(serverUrlInput.value, 'streams', { projectId }, 'GET');

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
                const newStream = await mcpRequest(serverUrlInput.value, 'streams/create', {
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

            if (selectedOption.dataset.token) {
                token = selectedOption.dataset.token;
            } else {
                try {
                    const resp = await mcpRequest(serverUrlInput.value, `streams/${streamId}/token`, {}, 'GET');
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

            // Save serverUrl globally, and full config for this tab
            chrome.storage.local.set({
                serverUrl: config.serverUrl,
                [configKey]: config
            }, () => {
                showConnectedState(uiElements, streamId);
                statusDiv.textContent = 'Connected! Reload page to start.';
                setTimeout(() => statusDiv.textContent = '', 3000);
            });
        });

        disconnectBtn.addEventListener('click', () => {
            chrome.storage.local.get([configKey], (result) => {
                const currentConfig = result[configKey] || {};
                const newConfig = { ...currentConfig, enabled: false };
                chrome.storage.local.set({ [configKey]: newConfig }, () => {
                    showStep1(uiElements);
                    statusDiv.textContent = 'Disconnected.';
                });
            });
        });
    });
});

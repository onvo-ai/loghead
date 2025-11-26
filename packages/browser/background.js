chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'INJECT_LOGHEAD') {
        if (sender.tab && sender.tab.id) {
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id },
                files: ['inject.js'],
                world: 'MAIN',
            }).catch(_err => {
                // console.error("[Loghead Background] Injection failed:", _err);
            });
        }
    }

    if (message.type === 'PROXY_LOG_INGEST') {
        const { endpoint, payload } = message;

        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
            .then(response => {
                if (response.ok) {
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: response.statusText });
                }
            })
            .catch(err => {
                sendResponse({ success: false, error: err.toString() });
            });

        return true; // Indicates async response
    }
});

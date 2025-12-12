// Check config and inject if enabled
chrome.storage.local.get(['serverUrl', 'streamId', 'enabled', 'token'], (config) => {
  if (config.enabled !== false && config.streamId && config.serverUrl) {
    injectScript(config);
  }
});

function injectScript(config) {
  // Request background script to inject the code into MAIN world
  chrome.runtime.sendMessage({ type: 'INJECT_LOGHEAD' });

  // Listen for messages from injected script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'LOGHEAD_LOG') {
      sendToServer(event.data.payload, config);
    }
  });
}

function sendToServer(payload, config) {
  const { serverUrl, streamId, token } = config;
  const endpoint = `${serverUrl}/api/ingest`;

  const logContent = `[${payload.level}] ${payload.args.join(' ')}`;

  chrome.runtime.sendMessage({
    type: 'PROXY_LOG_INGEST',
    endpoint: endpoint,
    token: token,
    payload: {
      streamId: streamId,
      logs: {
        content: logContent,
        metadata: {
          source: 'browser',
          url: payload.url,
          level: payload.level,
          timestamp: payload.timestamp
        }
      }
    }
  }, (response) => {
    if (!response || !response.success) {
      // Silent fail or minimal error logging
      console.error("[Loghead] Send failed:", response ? response.error : "Unknown error");
    }
  });
}

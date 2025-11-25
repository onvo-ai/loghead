(function () {
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
    };

    function sendToLoggerhead(level, args) {
        const payload = {
            level,
            args: args.map(a => {
                try {
                    return typeof a === 'object' ? JSON.stringify(a) : String(a);
                } catch (e) {
                    return String(a);
                }
            }),
            timestamp: new Date().toISOString(),
            url: window.location.href
        };
        window.postMessage({ type: 'LOGGERHEAD_LOG', payload }, '*');
    }

    console.log = function (...args) {
        originalConsole.log.apply(console, args);
        sendToLoggerhead('INFO', args);
    };

    console.error = function (...args) {
        originalConsole.error.apply(console, args);
        sendToLoggerhead('ERROR', args);
    };
    console.warn = function (...args) {
        originalConsole.warn.apply(console, args);
        sendToLoggerhead('WARN', args);
    };

    console.info = function (...args) {
        originalConsole.info.apply(console, args);
        sendToLoggerhead('INFO', args);
    };
})();

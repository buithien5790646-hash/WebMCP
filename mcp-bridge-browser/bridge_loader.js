(function() {
    console.log("[WebMCP] Bridge Handshake initiated...");

    const port = window.location.port;
    const params = new URLSearchParams(window.location.search);
    const target = params.get('target');

    if (!port || !target) {
        console.error("[WebMCP] Invalid bridge parameters");
        return;
    }

    // 发送握手信号给 Background
    chrome.runtime.sendMessage({ 
        type: 'HANDSHAKE', 
        port: port 
    }, (response) => {
        if (response && response.success) {
            console.log(`[WebMCP] Handshake success. Redirecting to ${target}...`);
            window.location.href = target;
        } else {
            document.body.innerHTML = "<h1>❌ Handshake Failed</h1><p>Could not communicate with extension background.</p>";
        }
    });
})();
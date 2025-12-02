document.addEventListener('DOMContentLoaded', () => {
    const configEditor = document.getElementById('config-editor');
    const statusContainer = document.getElementById('server-status-container');
    const saveBtn = document.getElementById('save-config-btn');
    const restartBtn = document.getElementById('restart-btn');
    const successAlert = document.getElementById('success-alert');
    const errorAlert = document.getElementById('error-alert');

    // 异步获取配置和状态
    async function fetchConfig() {
        hideAlerts();
        statusContainer.innerHTML = '<p>正在加载服务状态...</p>';
        configEditor.value = '正在加载配置...';

        try {
            const response = await fetch('/v1/config');
            const data = await response.json();

            // 1. 填充配置编辑器
            configEditor.value = JSON.stringify(data.config, null, 2);

            // 2. 显示服务器状态
            renderServerStatus(data.servers);

        } catch (error) {
            console.error('Error fetching config:', error);
            statusContainer.innerHTML = `<p style="color: red;">❌ 无法连接到网关 API。请确认 Node.js 服务已启动。</p>`;
            configEditor.value = '无法加载配置。';
        }
    }

    // 渲染服务器状态卡片
    function renderServerStatus(servers) {
        if (!servers || servers.length === 0) {
            statusContainer.innerHTML = '<p>当前未连接任何 MCP 服务。</p>';
            return;
        }

        statusContainer.innerHTML = servers.map(server => {
            const statusClass = server.status === 'connected' ? 'status-connected' : 'status-disconnected';
            const statusText = server.status === 'connected' ? '🟢 已连接' : '🔴 未连接';

            return `
                <div class="server-card">
                    <h3>${server.id}</h3>
                    <p>状态: <span class="status-badge ${statusClass}">${statusText}</span></p>
                    <p>加载工具数: <strong>${server.toolCount}</strong></p>
                    <p>配置命令:</p>
                    <pre>${server.config.command} ${server.config.args.join(' ')}</pre>
                </div>
            `;
        }).join('');
    }

    // --------------------------------------------------
    //               新增强制重启逻辑
    // --------------------------------------------------
    restartBtn.addEventListener('click', async () => {
        if (!confirm('确定要重启所有 MCP 服务吗？这将中断 AI 当前的操作。')) return;
        await sendCommand('/v1/servers/restart', null, '重启服务');
    });

    // --------------------------------------------------
    //             新增保存配置并重启逻辑
    // --------------------------------------------------
    saveBtn.addEventListener('click', async () => {
        if (!confirm('确定要保存并重启服务吗？')) return;

        let newConfig;
        try {
            newConfig = JSON.parse(configEditor.value);
        } catch (e) {
            showAlert('error', `❌ JSON 格式错误：${e.message}`);
            return;
        }

        await sendCommand('/v1/config', { config: newConfig }, '保存配置');
    });

    // --------------------------------------------------
    //                    通用发送命令函数
    // --------------------------------------------------
    async function sendCommand(url, body, actionName) {
        saveBtn.disabled = true;
        restartBtn.disabled = true;
        hideAlerts();
        showAlert('success', `⏳ 正在执行 ${actionName}，请稍候...`);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined
            });
            
            const result = await response.json();

            if (response.ok && result.success) {
                showAlert('success', `✅ ${actionName} 成功：${result.message}`);
            } else {
                const errorMessage = result.error || '未知错误';
                showAlert('error', `❌ ${actionName} 失败：${errorMessage}`);
            }
        } catch (error) {
            showAlert('error', `❌ 网络错误或服务器无响应：${error.message}`);
        } finally {
            saveBtn.disabled = false;
            restartBtn.disabled = false;
            // 无论成功还是失败，都重新拉取状态
            fetchConfig();
        }
    }

    // --------------------------------------------------
    //                    警示框管理
    // --------------------------------------------------
    function showAlert(type, message) {
        hideAlerts();
        const alertElement = type === 'success' ? successAlert : errorAlert;
        alertElement.textContent = message;
        alertElement.style.display = 'block';
    }

    function hideAlerts() {
        successAlert.style.display = 'none';
        errorAlert.style.display = 'none';
    }

    // 初始化加载
    fetchConfig();
});
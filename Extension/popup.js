document.addEventListener('DOMContentLoaded', () => {
  const portInput = document.getElementById('port');
  const autoSendInput = document.getElementById('autoSend');
  const statusDiv = document.getElementById('status');

  // 1. 加载默认配置
  chrome.storage.sync.get(['port', 'autoSend'], (items) => {
    portInput.value = items.port || 3000;
    // 如果是 undefined 默认为 true，否则用存的值
    autoSendInput.checked = items.autoSend !== undefined ? items.autoSend : true;
  });

  // 2. 监听修改并保存
  const saveOptions = () => {
    const port = portInput.value;
    const autoSend = autoSendInput.checked;

    chrome.storage.sync.set(
      { port: port, autoSend: autoSend },
      () => {
        // 显示保存提示
        statusDiv.style.opacity = '1';
        setTimeout(() => {
          statusDiv.style.opacity = '0';
        }, 1500);
      }
    );
  };

  portInput.addEventListener('input', saveOptions);
  autoSendInput.addEventListener('change', saveOptions);
});
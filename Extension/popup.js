const INITIAL_PROMPT = `你是一个 AI 助手。目前用户已经赋予了你新的能力，你可以通过生成特定的 JSON 指令来操作用户的本地电脑（如读写文件、执行命令、管理 Git 等）。\r\n\r\n# Protocol (通信协议)\r\n为了调用工具，你必须输出一个 **JSON 代码块**。严禁使用 Markdown 链接或普通文本描述来代替工具调用。\r\n\r\n## 1. 请求格式 (你发送给 Plugin)\r\n当你想执行操作时，请输出：\r\n\`\`\`json\r\n{\r\n  \"mcp_action\": \"call\", \r\n  \"name\": \"工具名称\", \r\n  \"arguments\": {\r\n    \"key\": \"value\"\r\n  },\r\n  \"request_id\": \"step_1\"\r\n}\r\n\`\`\`\r\n\r\n## 2. 响应格式 (Plugin 返回给你)\r\n\r\n用户端插件会自动执行上述 JSON，并将结果以以下格式发回给你：\r\n\r\n\`\`\`json\r\n{\r\n  \"mcp_action\": \"result\",\r\n  \"request_id\": \"step_1\",\r\n  \"output\": \"这里是文件内容或命令执行结果...\"\r\n}\r\n\`\`\`\r\n\r\n# Initialization (初始化)\r\n\r\n你现在的首要任务是**发现当前环境有哪些工具可用**。\r\n由于我使用了动态的 MCP 服务，我不知道具体有哪些工具名。\r\n\r\n请务必先执行以下步骤：\r\n\r\n1.  请不要猜测工具名称。\r\n2.  请直接尝试调用一个名为 \`list_tools\` 的工具（这通常是网关自带的）或者询问我。\r\n3.  如果不知道具体工具，请假设我安装了标准的 Filesystem Server，尝试使用 JSON 调用它。\r\n\r\n# 其他规则\r\n\r\n1. 每次回答只能调用一次工具，等得到返回再调用下一次。\r\n2. 如果有非常非常危险的操作，比如删除所有文件等，需要先征得用户同意再调用。\r\n3. 不要质疑，用户说你有这个能力就有，与其质疑，不如发送你的第一条指令。\r\n\r\n现在，请**获得目前拥有哪些能力**，以此来测试连接是否成功。`;

chrome.storage.local.set({ initialPrompt: INITIAL_PROMPT });

document.addEventListener("DOMContentLoaded", () => {
  const portInput = document.getElementById("port");
  const autoSendInput = document.getElementById("autoSend");
  const autoPromptInput = document.getElementById("autoPrompt");
  const statusDiv = document.getElementById("status");

  // 1. 加载默认配置
  chrome.storage.sync.get(
    ["port", "autoSend", "autoPromptEnabled"],
    (items) => {
      portInput.value = items.port || 3000;
      // 如果是 undefined 默认为 true，否则用存的值
      autoSendInput.checked =
        items.autoSend !== undefined ? items.autoSend : true;
      // 新增：加载 Auto Prompt 配置
      autoPromptInput.checked =
        items.autoPromptEnabled !== undefined ? items.autoPromptEnabled : true;
    }
  );

  // 2. 监听修改并保存
  const saveOptions = () => {
    const port = portInput.value;
    const autoSend = autoSendInput.checked;
    const autoPromptEnabled = autoPromptInput.checked;

    chrome.storage.sync.set(
      { port: port, autoSend: autoSend, autoPromptEnabled: autoPromptEnabled },
      () => {
        // 显示保存提示
        statusDiv.style.opacity = "1";
        setTimeout(() => {
          statusDiv.style.opacity = "0";
        }, 1500);
      }
    );
  };

  portInput.addEventListener("input", saveOptions);
  autoSendInput.addEventListener("change", saveOptions);
  autoPromptInput.addEventListener("change", saveOptions);
});

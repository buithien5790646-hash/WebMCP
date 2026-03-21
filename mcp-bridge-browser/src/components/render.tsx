import { h, render as preactRender } from 'preact';

/**
 * Shadow DOM 渲染挂载器
 *
 * 创建一个隔离的 Shadow DOM 容器，并将 Preact 组件渲染到其中。
 * 这样做可以防止宿主网页（如 ChatGPT, Gemini）的 CSS 样式泄露并污染到我们的扩展 UI 组件。
 *
 * @param Component 要渲染的 Preact 组件类
 * @param props 传递给组件的属性对象
 * @param containerId 挂载的根元素的 ID（如不存在则创建）
 * @returns 卸载组件并清理 DOM 的毁掉函数
 */
export function renderInShadow(
  Component: preact.ComponentType<any>,
  props: any = {},
  containerId: string
): () => void {
  // 检查容器是否已经存在
  let host = document.getElementById(containerId);
  if (!host) {
    // 动态创建挂载根节点
    host = document.createElement('div');
    host.id = containerId;
    Object.assign(host.style, {
      position: 'fixed',
      zIndex: 999999,
      top: 0,
      left: 0,
      width: '0', // 宽高设为 0 以防遮挡下方的网页交互
      height: '0',
    });
    document.body.appendChild(host);
  }

  // 获取现有的 shadow root，或者附加一个新的开放模式的 shadow root
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });

  // 在 shadow root 内部创建一个供 Preact 渲染的挂载点
  let mountPoint = shadow.querySelector('.preact-mount') as HTMLDivElement;
  if (!mountPoint) {
    mountPoint = document.createElement('div');
    mountPoint.className = 'preact-mount';
    shadow.appendChild(mountPoint);
  }

  // 渲染 Preact 组件到该挂载点
  preactRender(h(Component, props), mountPoint);

  // 返回一个闭包函数，用于在不需要时安全卸载该组件并清理宿主 DOM
  return () => {
    preactRender(null, mountPoint);
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
  };
}

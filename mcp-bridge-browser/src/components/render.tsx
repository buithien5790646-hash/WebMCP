import { h, render as preactRender } from 'preact';

/**
 * Creates a Shadow DOM container and renders a Preact component into it.
 * This prevents the host page's CSS from bleeding into our UI components.
 */
export function renderInShadow(
  Component: preact.ComponentType<any>,
  props: any = {},
  containerId: string
): () => void {
  // Check if container already exists
  let host = document.getElementById(containerId);
  if (!host) {
    host = document.createElement('div');
    host.id = containerId;
    Object.assign(host.style, {
      position: 'fixed',
      zIndex: 999999,
      top: 0,
      left: 0,
      width: '0',
      height: '0',
    });
    document.body.appendChild(host);
  }

  // Ensure shadow root exists
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });

  // Create a mount point inside the shadow root if it doesn't exist
  let mountPoint = shadow.querySelector('.preact-mount') as HTMLDivElement;
  if (!mountPoint) {
    mountPoint = document.createElement('div');
    mountPoint.className = 'preact-mount';
    shadow.appendChild(mountPoint);
  }

  // Render the component
  preactRender(h(Component, props), mountPoint);

  // Return an unmount function
  return () => {
    preactRender(null, mountPoint);
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
  };
}

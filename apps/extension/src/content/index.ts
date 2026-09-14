import { renderPanel } from './panel';
import { type ExtensionMessage, SHOW_PANEL } from '../shared/messages';

/** 宿主元素标识：重复注入时据此判断是否已经就绪。 */
const HOST_ID = 'du-kong-qi-host';

/**
 * 内容脚本入口：注入时只准备宿主元素，收到后台指令后才渲染浮窗。
 * 这样重复点击工具栏不会叠加出多个浮窗。
 */
function start(): void {
  if (document.getElementById(HOST_ID) !== null) {
    return;
  }

  const host = document.createElement('div');
  host.id = HOST_ID;
  document.documentElement.append(host);

  chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
    if (message.type === SHOW_PANEL.type) {
      renderPanel(host);
    }
  });
}

start();

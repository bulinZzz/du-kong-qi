import { SHOW_PANEL } from '../shared/messages';

/**
 * 后台 Service Worker。
 *
 * 目前只做一件事：把工具栏点击转成一次内容脚本注入加展示指令。
 * 调用后端也会放在这里——内容脚本发出的跨域请求受所在页面约束，后台不受此限。
 */
chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id;
  if (tabId === undefined) {
    return;
  }

  try {
    // 内容脚本自身会忽略重复注入，因此这里不需要判断是否已注入
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    await chrome.tabs.sendMessage(tabId, SHOW_PANEL);
  } catch (error) {
    console.error('读空气：浮窗注入失败', error);
  }
});

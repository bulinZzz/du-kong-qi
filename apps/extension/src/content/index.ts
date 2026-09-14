import { type DiscussionContent, extractDiscussion, loadDiscussion } from './extract';
import { type PanelActions, renderPanel } from './panel';
import { type ExtensionMessage, SHOW_PANEL } from '../shared/messages';

/** 宿主元素标识：重复注入时据此判断是否已经就绪。 */
const HOST_ID = 'du-kong-qi-host';

/**
 * 内容脚本入口：注入时只准备宿主元素，收到后台指令后才提取正文并渲染浮窗。
 * 每次点击都重新提取，这样用户滚动加载出更多内容后，重新分析拿到的就是新的文本。
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
      show(host, extractDiscussion(), false);
    }
  });
}

/** 用户点了"去读评论区"：滚到讨论区、等它加载，再按结果渲染。 */
async function showAfterLoading(host: HTMLElement): Promise<void> {
  show(host, await loadDiscussion(), true);
}

function show(host: HTMLElement, content: DiscussionContent, retried: boolean): void {
  const actions: PanelActions = {
    loadDiscussion: () => {
      void showAfterLoading(host);
    },
  };

  if (content.status === 'notReady') {
    renderPanel(host, { kind: 'empty', retried }, actions);
    return;
  }
  renderPanel(
    host,
    { kind: 'extracted', charCount: content.charCount, preview: content.text },
    actions,
  );
}

start();

import {
  type DiscussionContent,
  extractDiscussion,
  loadDiscussionByScrolling,
  loadDiscussionQuietly,
} from './extract';
import { type PanelActions, renderPanel } from './panel';
import { type ExtensionMessage, SHOW_PANEL } from '../shared/messages';

/** 宿主元素标识：重复注入时据此判断是否已经就绪。 */
const HOST_ID = 'du-kong-qi-host';

/**
 * 内容脚本入口：注入时只准备宿主元素，收到后台指令后才提取正文并渲染浮窗。
 * 每次点击都重新提取，这样页面内容变了之后重新分析拿到的就是新的文本。
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
      void analyze(host);
    }
  });
}

/**
 * 一次分析：先用页面上现成的内容；读不到就无感加载评论区；再读不到才把兜底按钮交给用户。
 * 无感加载不移动页面，用户在正常路径上只会看到"正在读评论区"和结果。
 */
async function analyze(host: HTMLElement): Promise<void> {
  const current = extractDiscussion();
  if (current.status === 'ready') {
    show(host, current, false);
    return;
  }

  renderPanel(host, { kind: 'loading' }, createActions(host));
  const loaded = await loadDiscussionQuietly();
  if (loaded.status === 'ready') {
    show(host, loaded, false);
    return;
  }
  renderPanel(host, { kind: 'empty', retried: false }, createActions(host));
}

/** 兜底路径：用户点了按钮，这次位移是他换来的。 */
async function readByScrolling(host: HTMLElement): Promise<void> {
  show(host, await loadDiscussionByScrolling(), true);
}

function createActions(host: HTMLElement): PanelActions {
  return {
    readDiscussion: () => {
      void readByScrolling(host);
    },
  };
}

function show(host: HTMLElement, content: DiscussionContent, retried: boolean): void {
  if (content.status === 'notReady') {
    renderPanel(host, { kind: 'empty', retried }, createActions(host));
    return;
  }
  renderPanel(
    host,
    { kind: 'extracted', charCount: content.charCount, preview: content.text },
    createActions(host),
  );
}

start();

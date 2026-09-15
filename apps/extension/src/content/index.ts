import {
  type DiscussionReady,
  extractDiscussion,
  loadDiscussionByScrolling,
  loadDiscussionQuietly,
} from './extract';
import { type PanelActions, renderPanel } from './panel';
import { type AnalyzeMessage, type ExtensionMessage, SHOW_PANEL } from '../shared/messages';
import type { AnalysisOutcome } from '../shared/protocol';

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
      void runAnalysis(host);
    }
  });
}

/**
 * 一次分析：先用页面上现成的内容；读不到就无感加载评论区；再读不到才把兜底按钮交给用户。
 * 无感加载不移动页面，用户在正常路径上只会看到加载提示与结果。
 */
async function runAnalysis(host: HTMLElement): Promise<void> {
  const current = extractDiscussion();
  if (current.status === 'ready') {
    await analyzeAndShow(host, current);
    return;
  }

  renderPanel(host, { kind: 'loading', phase: 'readingComments' }, createActions(host));
  const loaded = await loadDiscussionQuietly();
  if (loaded.status === 'ready') {
    await analyzeAndShow(host, loaded);
    return;
  }
  renderPanel(host, { kind: 'empty', retried: false }, createActions(host));
}

/** 兜底路径：用户点了按钮，这次位移是他换来的。 */
async function readByScrolling(host: HTMLElement): Promise<void> {
  renderPanel(host, { kind: 'loading', phase: 'readingComments' }, createActions(host));

  const content = await loadDiscussionByScrolling();
  if (content.status === 'notReady') {
    renderPanel(host, { kind: 'empty', retried: true }, createActions(host));
    return;
  }
  await analyzeAndShow(host, content);
}

async function analyzeAndShow(host: HTMLElement, content: DiscussionReady): Promise<void> {
  renderPanel(host, { kind: 'loading', phase: 'analyzing' }, createActions(host));
  const outcome = await requestAnalysis(content.text);

  if (outcome.status === 'ok') {
    renderPanel(host, { kind: 'result', analysis: outcome.analysis }, createActions(host));
    return;
  }
  renderPanel(host, { kind: 'failure', reason: outcome.reason }, createActions(host));
}

/** 请求交给后台：内容脚本的跨域请求受所在页面约束，后台不受。 */
async function requestAnalysis(text: string): Promise<AnalysisOutcome> {
  const message: AnalyzeMessage = { type: 'analyze', text };

  try {
    const outcome = (await chrome.runtime.sendMessage(message)) as AnalysisOutcome | undefined;
    return outcome ?? { status: 'failed', reason: 'unavailable' };
  } catch (error) {
    // 后台没有响应，通常是扩展刚被重新加载
    console.error('读空气：与后台通信失败', error);
    return { status: 'failed', reason: 'network' };
  }
}

function createActions(host: HTMLElement): PanelActions {
  return {
    readDiscussion: () => {
      void readByScrolling(host);
    },
  };
}

start();

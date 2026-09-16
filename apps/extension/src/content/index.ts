import {
  type DiscussionReady,
  extractDiscussion,
  loadDiscussionByScrolling,
  loadDiscussionQuietly,
  takeSample,
} from './extract';
import { type PanelActions, renderPanel } from './panel';
import {
  type DiscussionSnapshot,
  hasContentChanged,
  hasPageChanged,
  snapshotOf,
  takeSnapshot,
  WATCH_INTERVAL_MS,
} from './watch';
import { type AnalyzeMessage, type ExtensionMessage, SHOW_PANEL } from '../shared/messages';
import type { AnalysisOutcome, AtmosphereAnalysis } from '../shared/protocol';

/** 宿主元素标识：重复注入时复用它，不让宿主要在页面上堆成一串。 */
const HOST_ID = 'du-kong-qi-host';

/**
 * 上一次注入登记的监听器。
 *
 * 工具栏每点一次就会注入一次脚本，扩展重新加载后页面里还留着上一版脚本的宿主元素，
 * 只听"宿主在不在"会让新脚本直接退出——新扩展上下文里没有监听者，浮窗就再也打不开。
 * 所以这里只复用宿主、换上新监听器，并摘掉旧的那个。
 */
const world = globalThis as typeof globalThis & {
  __duKongQi?: { listener: (message: ExtensionMessage) => void };
};

/** 页面变化轮询的定时器。 */
let watchTimer: number | null = null;

/** 最近一次成功的结果：内容变多时要把它和提示一起留在浮窗上。 */
let lastAnalysis: AtmosphereAnalysis | null = null;

/**
 * 内容脚本入口：注入时只准备宿主元素，收到后台指令后才提取正文并渲染浮窗。
 * 每次点击都重新提取，这样页面内容变了之后重新分析拿到的就是新的文本。
 */
function start(): void {
  const previous = world.__duKongQi?.listener;
  if (previous !== undefined) {
    chrome.runtime.onMessage.removeListener(previous);
  }

  const host = document.getElementById(HOST_ID) ?? createHost();

  const listener = (message: ExtensionMessage): void => {
    if (message.type === SHOW_PANEL.type) {
      void runAnalysis(host);
    }
  };

  world.__duKongQi = { listener };
  chrome.runtime.onMessage.addListener(listener);
}

function createHost(): HTMLElement {
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.documentElement.append(host);
  return host;
}

/**
 * 一次分析：先用页面上现成的内容；读不到就无感加载评论区；再读不到才把兜底按钮交给用户。
 * 无感加载不移动页面，用户在正常路径上只会看到加载提示与结果。
 */
async function runAnalysis(host: HTMLElement): Promise<void> {
  stopWatching();

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

  const sample = takeSample(content.text);
  const outcome = await requestAnalysis(sample);

  if (outcome.status === 'ok') {
    lastAnalysis = outcome.analysis;
    renderPanel(
      host,
      { kind: 'result', analysis: outcome.analysis, expired: false },
      createActions(host),
    );
    watchForChanges(host, snapshotOf(sample));
    return;
  }

  lastAnalysis = null;
  renderPanel(host, { kind: 'failure', reason: outcome.reason }, createActions(host));
}

/**
 * 分析成功后盯住页面变化。
 *
 * 基线取的是刚送去分析的那一段，而不是此刻重读页面：两者之间页面若又加载了内容，
 * 那些内容并没有被这次分析覆盖，不该被当成已分析。
 */
function watchForChanges(host: HTMLElement, baseline: DiscussionSnapshot): void {
  stopWatching();
  watchTimer = window.setInterval(() => {
    checkChanges(host, baseline);
  }, WATCH_INTERVAL_MS);
}

function stopWatching(): void {
  if (watchTimer !== null) {
    window.clearInterval(watchTimer);
    watchTimer = null;
  }
}

/** 页面不可见时跳过：用户在别的标签页上，没有必要读这个页面。 */
function checkChanges(host: HTMLElement, baseline: DiscussionSnapshot): void {
  if (document.visibilityState !== 'visible') {
    return;
  }

  const current = takeSnapshot();
  if (current === null) {
    return;
  }

  if (hasPageChanged(baseline, current)) {
    stopWatching();
    lastAnalysis = null;
    renderPanel(host, { kind: 'pageChanged' }, createActions(host));
    return;
  }

  if (hasContentChanged(baseline, current) && lastAnalysis !== null) {
    stopWatching();
    renderPanel(
      host,
      { kind: 'result', analysis: lastAnalysis, expired: true },
      createActions(host),
    );
  }
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
    reanalyze: () => {
      void runAnalysis(host);
    },
    close: () => {
      // 关掉浮窗同时停掉轮询：用户主动收工时不该还在读页面
      stopWatching();
      lastAnalysis = null;
      host.replaceChildren();
    },
  };
}

start();

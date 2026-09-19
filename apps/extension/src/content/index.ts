import {
  type DiscussionReady,
  extractDiscussion,
  loadDiscussionByScrolling,
  loadDiscussionQuietly,
} from './extract';
import { type PanelActions, type PanelTarget, renderPanel, restorePanelState, setAutoOpen } from './panel';
import { loadPanelState, rememberPanelState } from './panel-state';
import { takePrivacyNotice } from './privacy-notice';
import {
  type DiscussionSnapshot,
  hasContentChanged,
  hasContentReplaced,
  hasPageChanged,
  snapshotOf,
  takeSnapshot,
  WATCH_INTERVAL_MS,
} from './watch';
import { isAutoOpenEnabled, originOf } from '../shared/auto-open';
import {
  type AnalyzeMessage,
  type ExtensionMessage,
  type RequestAutoOpenMessage,
  SHOW_PANEL_TYPE,
} from '../shared/messages';
import type { AnalysisOutcome, AtmosphereAnalysis } from '../shared/protocol';

/** 宿主元素标识：重复注入时复用它，不让宿主要在页面上堆成一串。 */
const HOST_ID = 'du-kong-qi-host';

/**
 * 上一次注入登记的东西。
 *
 * 工具栏每点一次就会注入一次脚本，扩展重新加载后页面里还留着上一版脚本的宿主元素，
 * 只听"宿主在不在"会让新脚本直接退出——新扩展上下文里没有监听者，浮窗就再也打不开。
 * 所以这里只复用宿主、换上新监听器，并摘掉旧的；旧的还得停手（见 shutdown）：
 * 它同样画在这个影子根上，也在读这个页面。
 */
const world = globalThis as typeof globalThis & {
  __duKongQi?: {
    listener: (message: ExtensionMessage) => void;
    onStorageChanged: () => void;
    /**
     * 停掉这一份脚本在做的事：轮询，以及还在等结论的那一轮分析。
     *
     * 可以不填：扩展升级后，页面里登记的还是上一版脚本的对象，它没有这个方法。
     */
    shutdown?: () => void;
  };
};

/** 页面变化轮询的定时器。 */
let watchTimer: number | null = null;

/**
 * 最近一次成功的结果，连同它的底细（读到几条内容）。
 *
 * 两样一起留：内容变多时要把旧分数和提示一起留在浮窗上，而"读了约 N 条"说的是这份结论
 * 覆盖到哪儿——分开存迟早会漏掉一处，让分数配上一个不属于它的条数。
 */
let lastResult: { analysis: AtmosphereAnalysis; readItems: DiscussionReady['items'] } | null = null;

/**
 * 这一次分析的凭据：为空表示没有正在进行、也不该再画的分析。
 *
 * 分析要等——等评论区加载，等模型判断，中间隔着好几秒。用户完全可能在这期间关掉浮窗，
 * 或者再点一次重新分析。光把 DOM 清掉不够：等回来的那段代码还会往同一个影子根里画一次，
 * 浮窗就自己回来了，两轮分析也会互相覆盖。所以每次分析开始时换一个新凭据、关闭时清空，
 * 异步返回后对不上就不再往下画。值本身没有内容，只回答"我还是不是当前那一次"。
 */
let currentRun: object | null = null;

/**
 * 内容脚本入口：注入时只准备宿主元素，收到后台指令后才提取正文并渲染浮窗。
 * 每次点击都重新提取，这样页面内容变了之后重新分析拿到的就是新的文本。
 */
function start(): void {
  const previous = world.__duKongQi;
  if (previous !== undefined) {
    chrome.runtime.onMessage.removeListener(previous.listener);
    chrome.storage.onChanged.removeListener(previous.onStorageChanged);
    // 摘掉监听器只是让它收不到新指令；它还在等的那一轮、还在跑的轮询得另外停掉
    previous.shutdown?.();
  }

  const host = document.getElementById(HOST_ID) ?? createHost();
  // 浮窗挂在影子根里：站点自己的样式再也进不来，滚动条与选中色这类伪元素也才写得进去
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });

  const listener = (message: ExtensionMessage): void => {
    if (message.type === SHOW_PANEL_TYPE) {
      void runAnalysis(root, message.auto);
    }
  };

  // 授权变了就重画：设置图标上的状态不该停在旧值上
  const onStorageChanged = (): void => {
    void syncAutoOpen();
  };

  world.__duKongQi = { listener, onStorageChanged, shutdown };
  chrome.runtime.onMessage.addListener(listener);
  chrome.storage.onChanged.addListener(onStorageChanged);
  void syncAutoOpen();
  void restorePanelStateFromSession();
}

/**
 * 把上次留下的浮窗样子读回来。
 *
 * 只记在本次浏览器会话里（见 panel-state），所以读不到就是回到默认：右上角、展开的面板。
 */
async function restorePanelStateFromSession(): Promise<void> {
  const state = await loadPanelState();
  if (state !== null) {
    restorePanelState(state);
  }
}

/** 把本站的授权状态读给渲染层。非 http(s) 页面没有可授权的站点，直接当作未开启。 */
async function syncAutoOpen(): Promise<void> {
  const origin = originOf(location.href);
  setAutoOpen(origin !== null && (await isAutoOpenEnabled(origin)));
}

function createHost(): HTMLElement {
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.documentElement.append(host);
  return host;
}

/**
 * 一次分析：先用页面上现成的内容；读不到就无感加载评论区；再读不到才把结论交给用户。
 * 无感加载不移动页面，用户在正常路径上只会看到加载提示与结果。
 *
 * `auto` 表示这次是进站自动打开的，不是用户点的图标。两条路径只差一件事：自动打开
 * 只认"读到了"——没读到就不出现，连"正在读评论区"也不闪。这个站点的页面类型多得数不清，
 * 我们不知道哪一页该有讨论区，能确定的只有"读到了没有"；而在没读到的地方弹一块东西出来，
 * 无论写什么都是在替用户下结论。
 */
async function runAnalysis(host: PanelTarget, auto: boolean): Promise<void> {
  stopWatching();
  const run = beginRun();

  const current = extractDiscussion();
  if (current.status === 'ready') {
    await analyzeAndShow(host, current, run);
    return;
  }

  if (!auto) {
    renderPanel(host, { kind: 'loading', phase: 'readingComments' }, createActions(host));
  }

  const loaded = await loadDiscussionQuietly();
  if (!isCurrentRun(run)) {
    return;
  }
  if (loaded.status === 'ready') {
    await analyzeAndShow(host, loaded, run);
    return;
  }
  if (auto) {
    return;
  }

  renderPanel(host, { kind: 'empty', retried: false }, createActions(host));
}

/** 兜底路径：用户点了按钮，这次位移是他换来的。 */
async function readByScrolling(host: PanelTarget): Promise<void> {
  const run = beginRun();
  renderPanel(host, { kind: 'loading', phase: 'readingComments' }, createActions(host));

  const content = await loadDiscussionByScrolling();
  if (!isCurrentRun(run)) {
    return;
  }
  if (content.status === 'notReady') {
    renderPanel(host, { kind: 'empty', retried: true }, createActions(host));
    return;
  }
  await analyzeAndShow(host, content, run);
}

async function analyzeAndShow(
  host: PanelTarget,
  content: DiscussionReady,
  run: object,
): Promise<void> {
  renderPanel(host, { kind: 'loading', phase: 'analyzing' }, createActions(host));

  // 窗口在提取时就切好了：送去分析的、过期判断比对的、面板上说的条数，三处都是它
  const sample = content.text;
  const outcome = await requestAnalysis(sample);
  // 用户已经关了浮窗，或又开了新的一轮：这次不再画，说明也不记——
  // 等下一次分析跟着结局一起说，总好过记成"说过"而其实没人看见
  if (!isCurrentRun(run)) {
    return;
  }

  // 说明挂在"文字已经发出去"这件事上，与模型答没答出来无关：内容太少这类失败，
  // 文字照样到了服务器，那时不说，就得等到某次成功才补上，告知就晚于事实了
  const privacyNotice = await takePrivacyNotice();

  if (outcome.status === 'ok') {
    lastResult = { analysis: outcome.analysis, readItems: content.items };
    renderPanel(
      host,
      {
        kind: 'result',
        analysis: outcome.analysis,
        expired: false,
        privacyNotice,
        readItems: content.items,
      },
      createActions(host),
    );
    watchForChanges(host, snapshotOf(sample));
    return;
  }

  lastResult = null;
  renderPanel(host, { kind: 'failure', reason: outcome.reason, privacyNotice }, createActions(host));
}

/** 开始一轮分析：发一个新凭据，让此前还在等的那一轮作废。 */
function beginRun(): object {
  const run = {};
  currentRun = run;
  return run;
}

/** 这一轮还是不是当前那一次。收工会让当前凭据清空。 */
function isCurrentRun(run: object): boolean {
  return currentRun === run;
}

/**
 * 停掉这一份脚本在做的事。
 *
 * 用户关掉浮窗、或新一份脚本接手时都要走这里：前者是他主动收工，后者说明这一份已经不是
 * 当前那一个了（页面里注入的脚本不止一份，画的却是同一个影子根）。
 */
function shutdown(): void {
  stopWatching();
  currentRun = null;
}

/**
 * 分析成功后盯住页面变化。
 *
 * 基线取的是刚送去分析的那一段，而不是此刻重读页面：两者之间页面若又加载了内容，
 * 那些内容并没有被这次分析覆盖，不该被当成已分析。
 */
function watchForChanges(host: PanelTarget, baseline: DiscussionSnapshot): void {
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
function checkChanges(host: PanelTarget, baseline: DiscussionSnapshot): void {
  if (document.visibilityState !== 'visible') {
    return;
  }

  const current = takeSnapshot();
  if (current === null) {
    return;
  }

  if (hasPageChanged(baseline, current)) {
    stopWatching();
    lastResult = null;
    renderPanel(host, { kind: 'pageChanged' }, createActions(host));
    return;
  }

  // 被分析的那批讨论整段换了（换排序、换筛选）：旧分数与眼前的内容无关，
  // 和换页一样不给，也不留 lastResult
  if (hasContentReplaced(baseline, current)) {
    stopWatching();
    lastResult = null;
    renderPanel(host, { kind: 'discussionReplaced' }, createActions(host));
    return;
  }

  if (hasContentChanged(baseline, current) && lastResult !== null) {
    stopWatching();
    renderPanel(
      host,
      {
        kind: 'result',
        analysis: lastResult.analysis,
        expired: true,
        privacyNotice: false,
        readItems: lastResult.readItems,
      },
      createActions(host),
    );
  }
}

/** 请求交给后台：内容脚本的跨域请求受所在页面约束，后台不受。 */
async function requestAnalysis(text: string): Promise<AnalysisOutcome> {
  // 站点域名只为后端的用量记录服务：它是"哪个站点读不到内容"的唯一线索
  const message: AnalyzeMessage = { type: 'analyze', text, site: location.hostname };

  try {
    const outcome = (await chrome.runtime.sendMessage(message)) as AnalysisOutcome | undefined;
    return outcome ?? { status: 'failed', reason: 'unavailable' };
  } catch (error) {
    // 后台没有响应，通常是扩展刚被重新加载
    console.error('读空气：与后台通信失败', error);
    return { status: 'failed', reason: 'network' };
  }
}

function createActions(host: PanelTarget): PanelActions {
  return {
    readDiscussion: () => {
      void readByScrolling(host);
    },
    reanalyze: () => {
      void runAnalysis(host, false);
    },
    close: () => {
      // 用户主动收工：不该还在读页面，也不该让还在等结论的那段代码把浮窗又画回来
      shutdown();
      lastResult = null;
      host.replaceChildren();
    },
    autoOpenFrameUrl: autoOpenFrameUrl(),
    openAutoOpenPage: () => {
      void requestAutoOpen();
    },
    rememberState: (state) => {
      void rememberPanelState(state);
    },
  };
}

/**
 * 授权界面（扩展自己的页面）的地址，嵌在浮窗里用。
 *
 * 嵌入页面靠地址里的站点标识知道自己该管哪个站，所以这里必须带上它。
 */
function autoOpenFrameUrl(): string {
  const origin = originOf(location.href) ?? location.origin;
  return chrome.runtime.getURL(`options.html?embed=1&origin=${encodeURIComponent(origin)}`);
}

/** 兜底路径：面板里嵌不进来时，请后台把授权页单独开出来。 */
async function requestAutoOpen(): Promise<void> {
  const origin = originOf(location.href);
  if (origin === null) {
    return;
  }

  const message: RequestAutoOpenMessage = { type: 'requestAutoOpen', origin };

  try {
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    // 后台没有响应，通常是扩展刚被重新加载
    console.error('读空气：打开授权页面失败', error);
  }
}

start();

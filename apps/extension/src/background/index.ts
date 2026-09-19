import { isAutoOpenEnabled, originOf } from '../shared/auto-open';
import { isAnalyzeMessage, isRequestAutoOpenMessage, showPanelMessage } from '../shared/messages';
import { type AnalysisOutcome, isAtmosphereAnalysis } from '../shared/protocol';
import { cacheAnalysis, readCachedAnalysis } from './analysis-cache';

/** 后端地址：开发期指向本机，发布时由构建注入（见 vite.config.background.ts）。 */
const BACKEND_BASE_URL = __BACKEND_ORIGIN__;

/** 一次分析的等待上限：后端还要调模型，比普通接口给得宽一些。 */
const REQUEST_TIMEOUT_MS = 20000;

/** 站点域名交给后端的请求头名，与后端 UsageLogInterceptor 里的常量对应。 */
const SITE_HEADER = 'X-Discussion-Site';

/** 兜底窗口的尺寸：放得下标题、一句说明和一个按钮就够。 */
const AUTHORIZE_WINDOW_WIDTH = 460;
const AUTHORIZE_WINDOW_HEIGHT = 250;

/**
 * 后台 Service Worker。
 *
 * 四件事：把工具栏点击转成一次内容脚本注入加展示指令；在用户授权过的网站上自动做同样的事；
 * 替内容脚本请求后端——内容脚本发出的跨域请求受所在页面约束，后台不受此限；
 * 以及在浮窗嵌不进授权界面时，把授权页开成独立窗口。
 */

// 浮窗位置记在会话存储里，而会话存储默认不对内容脚本开放，这里显式放开
void chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id;
  if (tabId === undefined) {
    return;
  }

  try {
    await showPanel(tabId, false);
  } catch (error) {
    console.error('读空气：浮窗注入失败', error);
  }
});

/**
 * 进入授权过的网站时自动打开浮窗。
 *
 * 只在页面加载完成时触发一次：站内换页（地址变了但没有重新加载）由浮窗自己的"页面换过了"
 * 去提示，这里不重复插手。没有授权的站点看不到地址——扩展没有申请 tabs 权限——
 * 也就无从注入，授权本身就是这个功能的开关。
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || tab.url === undefined) {
    return;
  }
  void openPanelIfAuthorized(tabId, tab.url);
});

async function openPanelIfAuthorized(tabId: number, url: string): Promise<void> {
  const origin = originOf(url);
  if (origin === null || !(await isAutoOpenEnabled(origin))) {
    return;
  }

  try {
    await showPanel(tabId, true);
  } catch (error) {
    console.error('读空气：自动打开浮窗失败', error);
  }
}

/** 注入内容脚本并让它展示浮窗。内容脚本自身会忽略重复注入，所以不必先判断是否已注入。 */
async function showPanel(tabId: number, auto: boolean): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
  await chrome.tabs.sendMessage(tabId, showPanelMessage(auto));
}

/**
 * 打开授权页（独立窗口）。
 *
 * 这是兜底路径：正常情况下授权界面嵌在浮窗里，只有站点不允许嵌扩展页面时才走这里。
 *
 * 请求 host 权限必须在用户手势里进行（Chrome 的硬性要求），而内容脚本没有
 * chrome.permissions 这个 API，所以这里只把页面开出来，真正请求授权的是页面上的那次点击。
 */
async function openAuthorizationPage(origin: string): Promise<void> {
  const url = chrome.runtime.getURL(`options.html?origin=${encodeURIComponent(origin)}`);

  try {
    await chrome.windows.create({
      url,
      type: 'popup',
      width: AUTHORIZE_WINDOW_WIDTH,
      height: AUTHORIZE_WINDOW_HEIGHT,
      ...(await popupPosition()),
    });
  } catch (error) {
    console.error('读空气：打开授权弹窗失败', error);
  }
}

/**
 * 弹窗落在当前窗口的中上位置。
 *
 * 不指定位置时由系统决定，实测会跑到屏幕左下角——那里既不像一次提问，离用户正在看的地方也远。
 * 取不到窗口信息就不给位置，让系统自己安排，总比不开好。
 */
async function popupPosition(): Promise<{ left?: number; top?: number }> {
  try {
    const bounds = await chrome.windows.getLastFocused();
    const left = bounds.left ?? 0;
    const top = bounds.top ?? 0;
    const windowWidth = bounds.width ?? AUTHORIZE_WINDOW_WIDTH;
    const windowHeight = bounds.height ?? AUTHORIZE_WINDOW_HEIGHT;

    return {
      // 水平居中、纵向偏上：像一个从上面落下来的对话框
      left: Math.round(left + Math.max((windowWidth - AUTHORIZE_WINDOW_WIDTH) / 2, 0)),
      top: Math.round(top + Math.max((windowHeight - AUTHORIZE_WINDOW_HEIGHT) / 3, 0)),
    };
  } catch {
    return {};
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (isAnalyzeMessage(message)) {
    void analyze(message.text, message.site).then(sendResponse);
    return true; // 异步响应，保持消息通道打开
  }

  if (isRequestAutoOpenMessage(message)) {
    void openAuthorizationPage(message.origin);
  }
  return false;
});

/**
 * 请求后端做一次空气分析。
 *
 * 失败在这里就分成几类，内容脚本只负责按类别说人话。
 * 同一段内容在一次浏览器会话里只算一次：先查缓存，算完记下——缓存命中不会产生请求，
 * 所以后端的用量记的是请求数，不是使用次数。
 */
async function analyze(text: string, site: string): Promise<AnalysisOutcome> {
  const cached = await readCachedAnalysis(text);
  if (cached !== null) {
    return cached;
  }

  const outcome = await requestAnalysis(text, site);
  // 不等待写入：结论已经拿到了，记缓存不该让用户多等
  void cacheAnalysis(text, outcome);
  return outcome;
}

/** 真正发出请求的那一半。 */
async function requestAnalysis(text: string, site: string): Promise<AnalysisOutcome> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/atmosphere/analysis`, {
      method: 'POST',
      // 站点走请求头：请求体是对外契约里"被分析的内容"，而站点不参与分析，只用于后端记账
      headers: { 'Content-Type': 'application/json', [SITE_HEADER]: site },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (response.status === 422) {
      return { status: 'failed', reason: 'insufficientContent' };
    }
    if (!response.ok) {
      return { status: 'failed', reason: 'unavailable' };
    }

    const body = await readJson(response);
    if (!isAtmosphereAnalysis(body)) {
      return { status: 'failed', reason: 'unavailable' };
    }
    return { status: 'ok', analysis: body };
  } catch (error) {
    console.error('读空气：分析请求失败', error);
    return { status: 'failed', reason: 'network' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 解析失败与解析成功是两回事，单独处理，免得把网关返回的 HTML 算成网络故障。 */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

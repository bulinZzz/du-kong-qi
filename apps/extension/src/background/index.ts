import { isAutoOpenEnabled, originOf } from '../shared/auto-open';
import { isAnalyzeMessage, isRequestAutoOpenMessage, SHOW_PANEL } from '../shared/messages';
import { type AnalysisOutcome, isAtmosphereAnalysis } from '../shared/protocol';

/** 后端地址。开发期指向本机，部署确定后再改。 */
const BACKEND_BASE_URL = 'http://localhost:8080';

/** 一次分析的等待上限：后端还要调模型，比普通接口给得宽一些。 */
const REQUEST_TIMEOUT_MS = 20000;

/**
 * 后台 Service Worker。
 *
 * 三件事：把工具栏点击转成一次内容脚本注入加展示指令；在用户授权过的网站上自动做同样的事；
 * 替内容脚本请求后端——内容脚本发出的跨域请求受所在页面约束，后台不受此限。
 */

chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id;
  if (tabId === undefined) {
    return;
  }

  try {
    await showPanel(tabId);
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
    await showPanel(tabId);
  } catch (error) {
    console.error('读空气：自动打开浮窗失败', error);
  }
}

/** 注入内容脚本并让它展示浮窗。内容脚本自身会忽略重复注入，所以不必先判断是否已注入。 */
async function showPanel(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
  await chrome.tabs.sendMessage(tabId, SHOW_PANEL);
}

/**
 * 打开授权页面。
 *
 * 请求 host 权限必须在用户手势里进行（Chrome 的硬性要求），而内容脚本没有
 * chrome.permissions 这个 API，所以这里只把页面开出来，真正请求授权的是页面上的那次点击。
 */
async function openAuthorizationPage(origin: string): Promise<void> {
  const url = chrome.runtime.getURL(`options.html?origin=${encodeURIComponent(origin)}`);

  try {
    await chrome.tabs.create({ url });
  } catch (error) {
    console.error('读空气：打开授权页面失败', error);
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (isAnalyzeMessage(message)) {
    void analyze(message.text).then(sendResponse);
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
 */
async function analyze(text: string): Promise<AnalysisOutcome> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/atmosphere/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

import { isAnalyzeMessage, SHOW_PANEL } from '../shared/messages';
import { type AnalysisOutcome, isAtmosphereAnalysis } from '../shared/protocol';

/** 后端地址。开发期指向本机，部署确定后再改。 */
const BACKEND_BASE_URL = 'http://localhost:8080';

/** 一次分析的等待上限：后端还要调模型，比普通接口给得宽一些。 */
const REQUEST_TIMEOUT_MS = 20000;

/**
 * 后台 Service Worker。
 *
 * 两件事：把工具栏点击转成一次内容脚本注入加展示指令；替内容脚本请求后端——
 * 内容脚本发出的跨域请求受所在页面约束，后台不受此限。
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

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isAnalyzeMessage(message)) {
    return false;
  }

  void analyze(message.text).then(sendResponse);
  return true; // 异步响应，保持消息通道打开
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

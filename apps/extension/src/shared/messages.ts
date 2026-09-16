/**
 * 内容脚本与后台脚本之间的消息约定：两侧共用同一份类型，
 * 让消息名写错这类问题在编译期暴露。
 */

/** 后台 → 内容脚本：展示浮窗并开始一次分析。 */
export type ShowPanelMessage = { type: 'showPanel' };

/**
 * 内容脚本 → 后台：代为请求后端。
 *
 * 请求放后台发出，因为内容脚本的跨域请求受所在页面约束。
 * 响应类型是 shared/protocol.ts 里的 AnalysisOutcome。
 */
export type AnalyzeMessage = { type: 'analyze'; text: string };

/**
 * 内容脚本 → 后台：为这个站点开启"进入时自动打开"。
 *
 * 带上站点标识，是因为后台不必再去读发送方标签页的地址；
 * 真正请求授权的是后台开出来的那个页面，内容脚本只负责转达意图。
 */
export type RequestAutoOpenMessage = { type: 'requestAutoOpen'; origin: string };

export type ExtensionMessage = ShowPanelMessage | AnalyzeMessage | RequestAutoOpenMessage;

export const SHOW_PANEL: ShowPanelMessage = { type: 'showPanel' };

export function isAnalyzeMessage(value: unknown): value is AnalyzeMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<AnalyzeMessage>;
  return candidate.type === 'analyze' && typeof candidate.text === 'string';
}

export function isRequestAutoOpenMessage(value: unknown): value is RequestAutoOpenMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<RequestAutoOpenMessage>;
  return candidate.type === 'requestAutoOpen' && typeof candidate.origin === 'string';
}

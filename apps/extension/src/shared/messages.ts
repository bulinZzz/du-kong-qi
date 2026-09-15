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

export type ExtensionMessage = ShowPanelMessage | AnalyzeMessage;

export const SHOW_PANEL: ShowPanelMessage = { type: 'showPanel' };

export function isAnalyzeMessage(value: unknown): value is AnalyzeMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<AnalyzeMessage>;
  return candidate.type === 'analyze' && typeof candidate.text === 'string';
}

/**
 * 内容脚本与后台脚本之间的消息约定：两侧共用同一份类型，
 * 让消息名写错这类问题在编译期暴露。
 */

/** 消息名。两侧共用它，写错在编译期就暴露。 */
export const SHOW_PANEL_TYPE = 'showPanel';

/**
 * 后台 → 内容脚本：展示浮窗并开始一次分析。
 *
 * 要区分是不是自动打开，因为两者的期待不同：用户点了图标，无论结果如何都得给他一个说法；
 * 自动打开只是他在这个站点上顺带授权的事，碰上没有讨论区的页面就不该出现——
 * 先弹出来再说"没东西可读"，比不出现更烦人。
 */
export type ShowPanelMessage = { type: typeof SHOW_PANEL_TYPE; auto: boolean };

export function showPanelMessage(auto: boolean): ShowPanelMessage {
  return { type: SHOW_PANEL_TYPE, auto };
}

/**
 * 内容脚本 → 后台：代为请求后端。
 *
 * 请求放后台发出，因为内容脚本的跨域请求受所在页面约束。
 * 响应类型是 shared/protocol.ts 里的 AnalysisOutcome。
 *
 * site 是这次读的是哪个站点，只用于后端的用量记录——哪个站点读不到内容、用户还在哪些站想用。
 * 它不参与分析：指标是绝对值，不该随站点缩放（见开发记录）。
 */
export type AnalyzeMessage = { type: 'analyze'; text: string; site: string };

/**
 * 内容脚本 → 后台：为这个站点开启"进入时自动打开"。
 *
 * 带上站点标识，是因为后台不必再去读发送方标签页的地址；
 * 真正请求授权的是后台开出来的那个页面，内容脚本只负责转达意图。
 */
export type RequestAutoOpenMessage = { type: 'requestAutoOpen'; origin: string };

export type ExtensionMessage = ShowPanelMessage | AnalyzeMessage | RequestAutoOpenMessage;

export function isAnalyzeMessage(value: unknown): value is AnalyzeMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<AnalyzeMessage>;
  return (
    candidate.type === 'analyze' &&
    typeof candidate.text === 'string' &&
    typeof candidate.site === 'string'
  );
}

export function isRequestAutoOpenMessage(value: unknown): value is RequestAutoOpenMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<RequestAutoOpenMessage>;
  return candidate.type === 'requestAutoOpen' && typeof candidate.origin === 'string';
}

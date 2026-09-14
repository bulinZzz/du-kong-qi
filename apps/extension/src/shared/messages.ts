/**
 * 内容脚本与后台脚本之间的消息约定：两侧共用同一个类型，
 * 让消息名写错这类问题在编译期就暴露。
 */
export type ExtensionMessage = {
  type: 'showPanel';
};

export const SHOW_PANEL: ExtensionMessage = { type: 'showPanel' };

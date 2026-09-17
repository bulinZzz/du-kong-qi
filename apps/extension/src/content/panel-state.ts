import type { PanelState } from './panel';

/**
 * 浮窗这一次的样子（落点与形态）的一次性记忆。
 *
 * 只存在本次浏览器会话里（storage.session）：换页、换标签时沿用它，
 * 浏览器一关就回到默认（右上角、展开的面板）。这样既不用每页重拖、重收，
 * 也不会攒下一份越积越旧的状态——于是也不需要"恢复默认位置"那样的出口。
 *
 * 尺寸不在其中：尺寸跟着内容看，每次回到默认更省事（见开发记录）。
 */

/** 会话存储里的键名。 */
const STORAGE_KEY = 'panelState';

/** 读回上次的样子；没有、或读不到（会话存储没放开）就当作没有，浮窗用默认。 */
export async function loadPanelState(): Promise<PanelState | null> {
  try {
    const stored = await chrome.storage.session.get(STORAGE_KEY);
    const value: unknown = stored[STORAGE_KEY];
    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const candidate = value as { position?: unknown; minimized?: unknown };
    return {
      position: readPosition(candidate.position),
      minimized: candidate.minimized === true,
    };
  } catch {
    return null;
  }
}

export async function rememberPanelState(state: PanelState): Promise<void> {
  try {
    await chrome.storage.session.set({ [STORAGE_KEY]: state });
  } catch {
    // 记不住就算了：这次会话里浮窗本来就在那儿，下次回到默认也不是错
  }
}

function readPosition(value: unknown): PanelState['position'] {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as { left?: unknown; top?: unknown };
  return typeof candidate.left === 'number' && typeof candidate.top === 'number'
    ? { left: candidate.left, top: candidate.top }
    : null;
}

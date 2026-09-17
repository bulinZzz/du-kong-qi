import { type AnalysisOutcome, isAtmosphereAnalysis } from '../shared/protocol';

/**
 * 一次分析结论的会话内缓存。
 *
 * 钱和等待都在模型那一侧：同一段内容在一次浏览器会话里只该算一次。最常撞上的是"自动打开"——
 * 每进一次站、每刷一次页面都是一次调用，而内容往往没变。
 *
 * 存在会话存储里：浏览器一关就清空，攒不出一份越积越旧、来路不明的结论。
 * 键取内容哈希，值只放结论——会话存储里不必再留一份讨论正文。
 * 容量不做淘汰：上限 10MB、每条几百字节，正常使用到不了。
 */

/** 会话存储里的键名前缀，一段内容一个键。 */
const KEY_PREFIX = 'analysis:';

/** 读一次缓存。没有、或形状不认识（扩展升级可能改过形状）都当作没有。 */
export async function readCachedAnalysis(text: string): Promise<AnalysisOutcome | null> {
  try {
    const key = await cacheKey(text);
    const stored = await chrome.storage.session.get(key);
    return readOutcome(stored[key]);
  } catch {
    return null;
  }
}

/**
 * 记下一次结论。
 *
 * 只记确定性的结论：成功，以及"内容太少"——后者是内容本身的判断，同样的内容再问一次还是同一句话。
 * 服务不可用、网络不通这类暂时性失败不记：一次后端抽风不该让这个页面在这一整个会话里都不再尝试。
 */
export async function cacheAnalysis(text: string, outcome: AnalysisOutcome): Promise<void> {
  if (!isWorthCaching(outcome)) {
    return;
  }

  try {
    const key = await cacheKey(text);
    await chrome.storage.session.set({ [key]: outcome });
  } catch {
    // 存不下就算了：这次会话里多花一次调用，不是错
  }
}

function isWorthCaching(outcome: AnalysisOutcome): boolean {
  return outcome.status === 'ok' || outcome.reason === 'insufficientContent';
}

async function cacheKey(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${KEY_PREFIX}${hex}`;
}

/** 存储是一个信任边界：读回来的东西受运行时校验，不靠类型断言。 */
function readOutcome(value: unknown): AnalysisOutcome | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as { status?: unknown; analysis?: unknown; reason?: unknown };
  if (candidate.status === 'ok' && isAtmosphereAnalysis(candidate.analysis)) {
    return { status: 'ok', analysis: candidate.analysis };
  }
  if (candidate.status === 'failed' && candidate.reason === 'insufficientContent') {
    return { status: 'failed', reason: 'insufficientContent' };
  }
  return null;
}

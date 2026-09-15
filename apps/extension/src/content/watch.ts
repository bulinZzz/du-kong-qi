import { extractDiscussion, takeSample } from './extract';

/**
 * 讨论内容的快照：被分析那一段的行集合，与当时的路径。
 *
 * 路径只取 pathname：站点常在 query 里追加跟踪参数（B 站的 vd_source、spm_id_from 之类），
 * 比较完整地址会把它们当成换页。实测 B 站的评论排序切换也不改地址。
 */
export type DiscussionSnapshot = {
  path: string;
  lines: ReadonlySet<string>;
};

/** 比对周期。 */
export const WATCH_INTERVAL_MS = 10000;

/** 新增行占比达到这个比例，或新增行数达到这个条数，就认为内容变到值得重算。 */
const CHANGED_RATIO = 0.2;
const CHANGED_LINES = 10;

/**
 * 用一段已有的文本构造快照。
 *
 * 行先去掉重复再比：同一句话反复出现（"同感""+1"）不该被算成内容增长。
 * 只取送去分析的那一段：窗口之外的增减与这次分析无关。
 */
export function snapshotOf(text: string): DiscussionSnapshot {
  const lines = takeSample(text).split('\n');
  // 截断处可能是半行，去掉它，免得每次都被算成新增
  lines.pop();

  return {
    path: window.location.pathname,
    lines: new Set(lines.filter((line) => line !== '')),
  };
}

/** 取当前页面的快照；读不到内容时返回 null。 */
export function takeSnapshot(): DiscussionSnapshot | null {
  const content = extractDiscussion();
  return content.status === 'ready' ? snapshotOf(content.text) : null;
}

/** 路径变了意味着换了一个页面，上一个结果与新页面无关。 */
export function hasPageChanged(before: DiscussionSnapshot, now: DiscussionSnapshot): boolean {
  return before.path !== now.path;
}

/**
 * 内容是否变到值得重算。
 *
 * 只比新增行：评论是逐条出现的，新出现的行才说明分析所覆盖的那段变了——
 * 变多、或者换了排序导致整段被替换，都走这条判断。
 * 行数减少通常是渲染差异，不构成重算的理由。
 */
export function hasContentChanged(before: DiscussionSnapshot, now: DiscussionSnapshot): boolean {
  let added = 0;
  for (const line of now.lines) {
    if (!before.lines.has(line)) {
      added += 1;
    }
  }

  return added >= CHANGED_LINES || added >= Math.max(now.lines.size, 1) * CHANGED_RATIO;
}

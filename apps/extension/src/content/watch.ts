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
 * 被分析那段的行里，消失这个比例就当作"整段被替换"。
 *
 * 换排序、换筛选条件都会让整批评论换掉。它与"评论又多了几条"不是一回事：前者换完，
 * 被分析的那段一条都不在眼前了，旧分数与眼前的内容无关；后者那段还在，只是又长了。
 */
const REPLACED_RATIO = 0.5;

/**
 * 只比够长的行。
 *
 * 相对时间（"3分钟前"→"4分钟前"）与点赞数这类短行每次刷新都可能变，攒几条就够凑到阈值，
 * 于是讨论没变也提示重算。短回复（"同感"）也会被这句滤掉，但它们本来就不构成"变化大"。
 */
const MIN_MEANINGFUL_LINE = 8;

/**
 * 用一段已有的文本构造快照。
 *
 * 行先去掉重复再比：同一句话反复出现（"同感""+1"）不该被算成内容增长。
 * 只取送去分析的那一段：窗口之外的增减与这次分析无关。
 */
export function snapshotOf(text: string): DiscussionSnapshot {
  const sample = takeSample(text);
  const lines = sample.split('\n');
  // 样本被窗口截断时，最后一行可能是半行，去掉它，免得每次都被算成新增；
  // 没截断就是内容真的到头了，最后一行也是完整的一条，不该白丢
  if (sample.length < text.length) {
    lines.pop();
  }

  return {
    path: window.location.pathname,
    lines: new Set(lines.filter((line) => line.length >= MIN_MEANINGFUL_LINE)),
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
 * 只比新增行：评论是逐条出现的，新出现的行才说明分析所覆盖的那段变了。
 * 行数减少通常是渲染差异，不构成重算的理由——整段被换掉那种情形由
 * {@link hasContentReplaced} 单独判断。
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

/**
 * 被分析的那段是否整段被换掉了。
 *
 * 判据是"消失"而不是"新增"：换排序之后新来的一批当然也是新的，但真正说明"换了"的是
 * 原先那批不见了。评论自然增长时旧行都在，这里恒为 false。
 */
export function hasContentReplaced(before: DiscussionSnapshot, now: DiscussionSnapshot): boolean {
  if (before.lines.size === 0) {
    return false;
  }

  let gone = 0;
  for (const line of before.lines) {
    if (!now.lines.has(line)) {
      gone += 1;
    }
  }

  return gone >= before.lines.size * REPLACED_RATIO;
}

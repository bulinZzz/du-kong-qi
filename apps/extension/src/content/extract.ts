/**
 * 提取结果。
 *
 * 只有两种：读到了，或者没读到。"没读到"不细分原因——想分出"这一页没有讨论区"就得知道
 * 每种页面长什么样，而页面类型是列不完的（同一个视频站就有首页、搜索、动态、直播间、
 * 课堂、会员购……），这张表永远补不全，还会随站点改版失效。真话只有一句：没读到内容。
 *
 * 所以这里也不做"整页回退去凑内容"：那会把导航与推荐位当成讨论正文，比没读到更糟。
 */
export type DiscussionContent =
  | { status: 'ready'; text: string; charCount: number }
  | { status: 'notReady' };

/** 已经读到内容的那一种，调用方判过之后传它，免得下游再判一次。 */
export type DiscussionReady = Extract<DiscussionContent, { status: 'ready' }>;

/**
 * 已适配站点：给出该站点里承载讨论的容器。
 *
 * 按容器找，不按页面类型找——同一个站点的页面类型多得数不清（首页、搜索、直播间、
 * 会员购、热榜、专栏……），这张表补不全，还会随改版失效。容器在就按它读，不在就说没读到。
 *
 * 站点之间的差异只有两处：内容区在不在影子根里，以及要不要等它渲染。B 站两样都占，
 * 所以多一个内层选择器、还要无感加载；知乎与微博移动站的讨论在页面加载时就已渲染好。
 */
type SiteExpectation = {
  hostSuffix: string;
  selector: string;
  /** 内容区在容器影子根里的站点才有；缺省表示容器本身就是内容区。 */
  innerShadowSelector?: string;
};

const SITE_EXPECTATIONS: ReadonlyArray<SiteExpectation> = [
  { hostSuffix: 'bilibili.com', selector: 'bili-comments', innerShadowSelector: '#feed' },
  { hostSuffix: 'zhihu.com', selector: '#QuestionAnswers-answers' },
  { hostSuffix: 'weibo.cn', selector: '.comment-content' },
];

/** 通用回退：没有站点约定时，按语义容器找，都找不到才用整页。 */
const GENERIC_SELECTORS = ['#commentapp', 'main', 'article', '[role="main"]'];

/**
 * 评论区的常见挂载点。
 *
 * 讨论是评论之间的事，而 main／article 里往往先是楼主正文：长正文会把窗口占满，
 * 把评论区挤出镜头。所以这里优先只要评论区，够大才算数——小到只有"评论"两个字的块，
 * 会把窗口挤成一句话。
 */
const COMMENT_SELECTORS = ['#commentapp', '[class*="comment"]', '[id*="comment"]'];

/** 每个选择器最多看几个候选：一个页面里带 comment 字样的节点可能成百上千。 */
const MAX_COMMENT_CANDIDATES = 8;

/** 这些标签承载导航、装饰或交互控件，不属于讨论内容。 */
const NOISE_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'NAV',
  'HEADER',
  'FOOTER',
  'ASIDE',
  'SVG',
  'IFRAME',
  'CANVAS',
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
]);

/**
 * 界面文字的行形态。
 *
 * 标签与可见性挡不住页面自己的控件文字：评论列表里每条都跟着时间、"共 59 条回复，
 * 点击查看"、单独一个"回复"。实测这些约占样本的两成——白占一万字的窗口，也让
 * "讨论有没有变化"的比对多了一堆与讨论无关的行（相对时间还会随时间变）。
 *
 * 按行的形态丢，不按站点结构丢：结构每个站点都不一样，而"一条时间戳长什么样"是通用的。
 * 用户名不在此列——它和"同感"这类短回复长得一样，通用规则分不开，只能靠站点结构识别。
 */
const UI_LINE_PATTERNS: readonly RegExp[] = [
  // 绝对时间：2026-09-17 20:58、22-09-12 11:33、2026-09-17
  /^\d{2,4}-\d{1,2}-\d{1,2}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/,
  // 相对时间：刚刚、3分钟前、2 小时前
  /^(刚刚|\d+\s*(秒|分钟|小时|天|周|个月|年)前)$/,
  // 回复计数：共 59 条回复，点击查看；共1条回复
  /^共\s*\d+\s*条回复(，?\s*点击查看)?$/,
  // 单个标点也算一行，来自被拆开的控件文字
  /^[，。、；：？！…—～·,.;:?!]+$/,
  // 光秃秃的控件词
  /^(点击查看|展开|展开更多|查看更多|加载更多|收起|回复|点赞|点踩|赞|分享|收藏|关注|已关注|举报|置顶|热门|最新|按时间|按热度)$/,
];

const NOT_READY: DiscussionContent = { status: 'notReady' };

/** 无感加载的最长等待时间。 */
const QUIET_LOAD_TIMEOUT_MS = 8000;

/**
 * 等讨论容器出现的时间。
 *
 * 它远小于上面那个总预算：容器在页面骨架里，实测加载完成时就已经存在，后面才填内容是另一回事。
 * 给容器留整个预算，会让读不到内容的页面白等满 8 秒，而那种页面恰恰最多。
 *
 * 这不是在判断页面类型，只是按实测给等待划一条止损线：容器更晚出现就让它更晚，
 * 用户仍然可以自己滚一下再来。
 */
const CONTAINER_WAIT_MS = 1500;

/** 判定内容已渲染稳定的两次快照间隔。 */
const SETTLE_INTERVAL_MS = 500;

/**
 * 连续几次快照一致才算稳定。
 *
 * 评论是分批来的，中间有间隙：只隔一次就开算，容易在间隙里"以为读完了"，
 * 于是刚分析完又跳一次"讨论有新变化"。
 */
const SETTLED_SNAPSHOTS = 3;

/**
 * 评论区值得优先于整页的最小体量。
 *
 * 它只管"取哪一块"：评论区太小（容器里只有"评论"两个字那种）时退回整页，
 * 有内容的判断总比没有强。它不参与"要不要继续等"——等待由"连着几次快照一致"决定，
 * 与字数无关：页面只有几百字时，等满 8 秒也等不来第 604 个字。
 */
const MIN_COMMENT_SECTION_LENGTH = 2000;

/**
 * 送去分析的最大长度。
 *
 * 后端还会再截断一次作为兜底，但"这次分析覆盖了哪一段"由这里决定：过期判断比对的也是这一段，
 * 否则用户只是往下翻、让窗口之外加载出更多评论，也会被提示"内容变了"。
 */
const MAX_SAMPLE_CHARS = 10000;

/** 把讨论容器搬进视口时，让它的顶部停在视口内这个位置。 */
const QUIET_TOP_OFFSET = 120;

/** 兜底滚动路径的轮询间隔。 */
const SCROLL_POLL_INTERVAL_MS = 300;

/** 兜底滚动路径里容器还没挂载时，逐屏下推的最大步数：讨论区通常在首屏下方不远处。 */
const MAX_SCROLL_STEPS = 6;

/**
 * 读取当前页面的讨论文本。
 *
 * 逐节点遍历而不是读 body.innerText：后者不下钻 shadow root，而论坛与视频站的评论正文
 * 往往渲染在 shadow root 内，读 body 只能拿到导航和推荐位。
 */
export function extractDiscussion(): DiscussionContent {
  const expectation = findSiteExpectation();
  if (expectation !== null) {
    const root = resolveExpectation(expectation);
    return root === null ? NOT_READY : toContent(root);
  }

  const comments = findCommentContent();
  if (comments !== null) {
    return comments;
  }

  for (const selector of GENERIC_SELECTORS) {
    const found = document.querySelector(selector);
    if (found !== null) {
      const content = toContent(found);
      if (content.status === 'ready') {
        return content;
      }
    }
  }
  return toContent(document.body);
}

/**
 * 优先取评论区的内容。
 *
 * 评论区还没加载出来时不硬取：那时容器里可能只有"评论"两个字，与其拿它去分析，
 * 不如退回整页——有内容的判断总比没有强。
 */
function findCommentContent(): DiscussionContent | null {
  for (const selector of COMMENT_SELECTORS) {
    let checked = 0;
    for (const candidate of document.querySelectorAll(selector)) {
      if (checked >= MAX_COMMENT_CANDIDATES) {
        break;
      }
      checked += 1;

      const content = toContent(candidate);
      if (content.status === 'ready' && content.charCount >= MIN_COMMENT_SECTION_LENGTH) {
        return content;
      }
    }
  }
  return null;
}

/**
 * 无感加载：把讨论容器搬进视口，但不动页面，等它渲染稳定。
 *
 * 视频站的评论要进入视口才会加载。这里用相对定位把容器挪进视口——相对定位不改变布局，
 * 容器原来的位置和页面滚动位置都不变——再配合透明与禁止交互，用户看不到任何变化。
 * 容器已经在视口里时不搬：那说明加载由页面自己驱动。
 */
export async function loadDiscussionQuietly(): Promise<DiscussionContent> {
  const deadline = Date.now() + QUIET_LOAD_TIMEOUT_MS;
  // 容器只等一小段：实测它在页面加载完成时就已存在（B 站视频页与番剧页都是），
  // 等满整个预算只是在读不到内容的页面上白等
  const target = await waitForContainer(Math.min(deadline, Date.now() + CONTAINER_WAIT_MS));
  if (target === null) {
    return extractDiscussion();
  }

  const restore =
    target instanceof HTMLElement && !isInViewport(target) ? moveIntoViewportQuietly(target) : null;
  try {
    return await waitForSettledSample(deadline);
  } finally {
    restore?.();
  }
}

/**
 * 兜底加载：真的滚到讨论区，等它渲染。
 *
 * 加载不由可见性驱动的站点走这条路径，位移是用户点按钮换来的。
 */
export async function loadDiscussionByScrolling(): Promise<DiscussionContent> {
  const deadline = Date.now() + QUIET_LOAD_TIMEOUT_MS;
  let content = extractDiscussion();
  let scrolledSteps = 0;

  while (content.status === 'notReady' && Date.now() < deadline) {
    const target = findDiscussionContainer();
    if (target !== null) {
      target.scrollIntoView({ block: 'center' });
    } else if (scrolledSteps < MAX_SCROLL_STEPS) {
      window.scrollBy({ top: Math.round(window.innerHeight * 0.8) });
      scrolledSteps += 1;
    }
    await delay(SCROLL_POLL_INTERVAL_MS);
    content = extractDiscussion();
  }
  return content;
}

/** 等讨论容器挂载出来：它可能比页面主体晚出现。 */
async function waitForContainer(deadline: number): Promise<Element | null> {
  let container = findDiscussionContainer();
  while (container === null && Date.now() < deadline) {
    await delay(SETTLE_INTERVAL_MS);
    container = findDiscussionContainer();
  }
  return container;
}

/**
 * 把容器搬进视口：视觉位置进视口，布局与滚动位置都不变。
 * 返回还原函数，调用方必须在结束时调用，否则容器会一直停在被改状态。
 */
function moveIntoViewportQuietly(target: HTMLElement): () => void {
  const originalStyle = target.getAttribute('style');
  const shift = Math.round(target.getBoundingClientRect().top - QUIET_TOP_OFFSET);

  target.style.position = 'relative';
  target.style.top = `${-shift}px`;
  target.style.opacity = '0';
  target.style.pointerEvents = 'none';

  return () => {
    if (originalStyle === null) {
      target.removeAttribute('style');
    } else {
      target.setAttribute('style', originalStyle);
    }
  };
}

/**
 * 等到样本连着几次快照都不再增长：那说明这一次渲染结束了。
 *
 * 只看"还变不变"，不看字数。曾经要求样本达到某个字数才允许提前结束，结果页面本来就只有
 * 几百字时，那 8 秒里什么都不会再多——实测一份 603 字的页面，用户等了 8.5 秒才看到结果。
 */
async function waitForSettledSample(deadline: number): Promise<DiscussionContent> {
  let previousText = '';
  let stableCount = 0;
  let content = extractDiscussion();

  while (Date.now() < deadline) {
    await delay(SETTLE_INTERVAL_MS);
    content = extractDiscussion();

    if (content.status === 'ready' && content.text === previousText) {
      stableCount += 1;
      if (stableCount >= SETTLED_SNAPSHOTS) {
        return content;
      }
    } else {
      // 变了就重新数：评论还在往里加，现在不是开算的时候
      stableCount = 0;
    }
    previousText = content.status === 'ready' ? content.text : '';
  }
  return content;
}

function isInViewport(target: Element): boolean {
  const rect = target.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

/** 取出送去分析的那一段：讨论的前部内容。 */
export function takeSample(text: string): string {
  return text.slice(0, MAX_SAMPLE_CHARS);
}

function findSiteExpectation(): SiteExpectation | null {
  return expectationFor(window.location.hostname);
}

/** 站点期望按域名后缀匹配，子域（`www`、`zhuanlan`）一并算在内。 */
export function expectationFor(host: string): SiteExpectation | null {
  return SITE_EXPECTATIONS.find((expectation) => host.endsWith(expectation.hostSuffix)) ?? null;
}

function resolveExpectation(expectation: SiteExpectation): Element | ShadowRoot | null {
  const found = document.querySelector(expectation.selector);
  if (found === null) {
    return null;
  }
  if (expectation.innerShadowSelector === undefined) {
    return found;
  }
  // 内容区还没出现时，宁可判为未就绪，也不要退而取容器头部那些控件文案
  return found.shadowRoot?.querySelector(expectation.innerShadowSelector) ?? null;
}

/** 定位讨论容器本身（不是它内部的内容区）：滚动和搬运都以它为对象。 */
function findDiscussionContainer(): Element | null {
  const expectation = findSiteExpectation();
  if (expectation !== null) {
    return document.querySelector(expectation.selector);
  }
  for (const selector of GENERIC_SELECTORS) {
    const found = document.querySelector(selector);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

function toContent(root: Element | ShadowRoot): DiscussionContent {
  const text = collectText(root);
  return text === '' ? NOT_READY : { status: 'ready', text, charCount: text.length };
}

function collectText(root: Element | ShadowRoot): string {
  const parts: string[] = [];
  appendText(root, parts);
  return dropUiNoise(parts).join('\n');
}

/** 丢掉页面自己的界面文字，只留讨论。全部被丢掉时调用方会判为"没读到"。 */
export function dropUiNoise(lines: readonly string[]): string[] {
  return lines.filter((line) => !UI_LINE_PATTERNS.some((pattern) => pattern.test(line)));
}

function appendText(node: Node, parts: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (text !== undefined && text !== '') {
      parts.push(text);
    }
    return;
  }

  // ShadowRoot 是 DocumentFragment 而不是 Element，标签与可见性判断只对元素生效
  if (node instanceof Element) {
    if (NOISE_TAGS.has(node.tagName)) {
      return;
    }
    // 只统计用户看得见的内容；懒加载尚未渲染的占位元素在这里被排除
    if (!node.checkVisibility()) {
      return;
    }
  }

  for (const child of node.childNodes) {
    appendText(child, parts);
  }

  // 下钻 open shadow root：评论正文常在这一层，普通查询选择器看不见
  if (node instanceof Element && node.shadowRoot !== null) {
    appendText(node.shadowRoot, parts);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

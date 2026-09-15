/**
 * 提取结果。
 *
 * notReady 表示讨论内容还没渲染出来——容器尚未挂载，或已挂载但内容为空。
 * 这种状态下不能回退到整页去凑内容，否则导航与推荐位会被当成讨论正文。
 */
export type DiscussionContent =
  | { status: 'ready'; text: string; charCount: number }
  | { status: 'notReady' };

/** 已经读到内容的那一种，调用方判过之后传它，免得下游再判一次。 */
export type DiscussionReady = Extract<DiscussionContent, { status: 'ready' }>;

/** 已适配站点：讨论容器一定存在，只是要滚动到附近才渲染。 */
type SiteExpectation = {
  hostSuffix: string;
  selector: string;
  innerShadowSelector?: string;
};

const SITE_EXPECTATIONS: ReadonlyArray<SiteExpectation> = [
  { hostSuffix: 'bilibili.com', selector: 'bili-comments', innerShadowSelector: '#feed' },
];

/** 通用回退：没有站点约定时，按语义容器找，都找不到才用整页。 */
const GENERIC_SELECTORS = ['#commentapp', 'main', 'article', '[role="main"]'];

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

const NOT_READY: DiscussionContent = { status: 'notReady' };

/** 无感加载的最长等待时间。 */
const QUIET_LOAD_TIMEOUT_MS = 8000;

/** 判定内容已渲染稳定的两次快照间隔。 */
const SETTLE_INTERVAL_MS = 500;

/** 分析所需的最小样本量：达到它并且连续两次快照一致，才算读到足够的讨论内容。 */
const MIN_SAMPLE_LENGTH = 2000;

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
 * 无感加载：把讨论容器搬进视口，但不动页面，等它渲染出足够的样本。
 *
 * 视频站的评论要进入视口才会加载。这里用相对定位把容器挪进视口——相对定位不改变布局，
 * 容器原来的位置和页面滚动位置都不变——再配合透明与禁止交互，用户看不到任何变化。
 * 容器已经在视口里时不搬：那说明加载由页面自己驱动。
 */
export async function loadDiscussionQuietly(): Promise<DiscussionContent> {
  const deadline = Date.now() + QUIET_LOAD_TIMEOUT_MS;
  const target = await waitForContainer(deadline);
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

/** 等到样本达到下限、且连续两次快照一致，说明渲染已经稳定。超时则返回最后读到的东西。 */
async function waitForSettledSample(deadline: number): Promise<DiscussionContent> {
  let previousText = '';
  let content = extractDiscussion();

  while (Date.now() < deadline) {
    await delay(SETTLE_INTERVAL_MS);
    content = extractDiscussion();

    if (
      content.status === 'ready' &&
      content.charCount >= MIN_SAMPLE_LENGTH &&
      content.text === previousText
    ) {
      return content;
    }
    previousText = content.status === 'ready' ? content.text : '';
  }
  return content;
}

function isInViewport(target: Element): boolean {
  const rect = target.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function findSiteExpectation(): SiteExpectation | null {
  const host = window.location.hostname;
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
  // 站内约定的内容区还没出现时，宁可判为未就绪，也不要退而取容器头部那些控件文案
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
  return parts.join('\n');
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

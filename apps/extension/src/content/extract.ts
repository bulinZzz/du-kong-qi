/**
 * 提取结果。
 *
 * notReady 表示讨论内容还没渲染出来——容器尚未挂载，或已挂载但内容为空。
 * 这种状态下不能回退到整页去凑内容，否则导航与推荐位会被当成讨论正文。
 */
export type DiscussionContent =
  | { status: 'ready'; text: string; charCount: number }
  | { status: 'notReady' };

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

/** 等待讨论内容渲染出来的最长等待时间。 */
const LOAD_TIMEOUT_MS = 5000;

/** 等待期间轮询的间隔。 */
const LOAD_POLL_INTERVAL_MS = 300;

/** 容器还没挂载时逐屏下推的最大步数：讨论区通常在首屏下方不远处。 */
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
 * 把讨论区滚进视口并等它渲染出来。
 *
 * 视频站的评论要滚动到附近才加载，用户停在页面顶部时读不到任何内容。
 * 这个动作只由用户点击触发，因此滚动是他预期内的。
 */
export async function loadDiscussion(): Promise<DiscussionContent> {
  const deadline = Date.now() + LOAD_TIMEOUT_MS;
  let content = extractDiscussion();
  let scrolledSteps = 0;

  while (content.status === 'notReady' && Date.now() < deadline) {
    const target = findScrollTarget();
    if (target !== null) {
      target.scrollIntoView({ block: 'center' });
    } else if (scrolledSteps < MAX_SCROLL_STEPS) {
      window.scrollBy({ top: Math.round(window.innerHeight * 0.8) });
      scrolledSteps += 1;
    }
    await delay(LOAD_POLL_INTERVAL_MS);
    content = extractDiscussion();
  }
  return content;
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

function findScrollTarget(): Element | null {
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

import {
  addAutoOpenOrigin,
  disableAutoOpen,
  isAutoOpenEnabled,
  listAutoOpenOrigins,
  permissionPatternOf,
} from '../shared/auto-open';
import { PRIVACY_TEXT } from '../shared/privacy';

/**
 * 设置页面。
 *
 * 请求 host 权限必须在用户手势里进行，而内容脚本没有 chrome.permissions，
 * 所以"按网站授权"这件事只能落在扩展自己的页面上。三种进入方式：
 * 嵌在浮窗里（带 embed=1，去掉标题与底色，并把自身高度报回去）、
 * 后台开出的独立窗口（带站点标识，面板里嵌不进来时的兜底）、
 * 直接打开设置页（不带站点标识，列出已开启的网站）。
 *
 * 它不自己关：开关都在这一页上，随手关掉会让用户以为事情没办完。
 */
const params = new URLSearchParams(location.search);

/** 要管哪个站；为空表示用户自己打开了设置页。 */
const site = params.get('origin');

/** 嵌在浮窗里的模式。 */
const embedded = params.get('embed') === '1';

/** 上一次操作的反馈。显示过一次就清掉，免得下次重画又冒出来。 */
let notice: string | null = null;

/** 隐私声明是否展开。它管的是"事后想确认"，所以默认收起，点开才占版面。 */
let statementOpen = false;

/** 重画当前视图：站点视图，或用户自己打开时的已开启列表。 */
function render(): void {
  if (site === null) {
    void renderSiteList();
    return;
  }
  void renderSite(site);
}

/** 这一段设置管什么。标签要说清被打开的是什么，也要限定范围——它只管当前这个网站。 */
const SETTING_LABEL = '进入当前网站时自动打开读空气';

async function renderSite(origin: string): Promise<void> {
  const enabled = await isAutoOpenEnabled(origin);
  const button = enabled
    ? toggle(true, SETTING_LABEL, () => void revoke(origin))
    : toggle(false, SETTING_LABEL, () => requestPermission(origin));

  const card = document.createElement('div');

  // 嵌在浮窗里时只留一行：标签说这段设置管什么，开关说现在是开还是关
  if (embedded) {
    card.append(row(paragraph(SETTING_LABEL, 'muted'), button));
  } else {
    // 独立窗口的标题栏已经叫"设置"，里面就说到具体是哪一项；站点跟开关同一行
    card.append(heading(SETTING_LABEL), row(paragraph(origin, 'muted'), button));
  }

  paint(card);
}

async function renderSiteList(): Promise<void> {
  const origins = await listAutoOpenOrigins();

  const card = document.createElement('div');
  card.append(heading('设置'));

  if (origins.length === 0) {
    card.append(
      paragraph('还没有开启任何网站。'),
      paragraph('在网站页面上点浮窗标题栏的设置图标即可开启。', 'muted'),
    );
  } else {
    card.append(paragraph('进入这些网站时会自动打开读空气：', 'muted'), createSiteList(origins));
  }

  paint(card);
}

/** 落一次 DOM 并收尾：隐私声明入口、提示，以及嵌在浮窗里时把高度报回去。 */
function paint(card: HTMLElement): void {
  card.append(...createPrivacyStatement());
  app().replaceChildren(card);
  appendNotice(card);
  reportHeight();
}

/**
 * 隐私声明的入口：一行标签加一个动作，点开就地展开，再点收起。
 *
 * 它管的是"事后想确认"——第一次把文字发出去时，浮窗里已经说过一次最短的那句；
 * 完整的声明放在这里：什么时候发、最后一环留给谁，都由用户自己来看。
 * 写在设置里而不是正文里，是因为它是设置的一部分，不该跟着分析结果的长短浮动。
 */
function createPrivacyStatement(): Node[] {
  const button = action(statementOpen ? '收起' : '查看', 'plain', () => {
    statementOpen = !statementOpen;
    render();
  });
  button.setAttribute('aria-expanded', String(statementOpen));
  // 读屏器只念"查看"说不清看的是什么，补上对象；开头仍是同一个动作词，不违背可见文案
  button.setAttribute('aria-label', `${statementOpen ? '收起' : '查看'}隐私声明`);

  const nodes: Node[] = [row(paragraph(PRIVACY_TEXT.title, 'muted'), button)];
  if (statementOpen) {
    nodes.push(statement());
  }
  return nodes;
}

/** 声明的正文：什么时候发、谁在判断、最后一环留给谁、以及用户能怎么办。 */
function statement(): HTMLElement {
  const block = document.createElement('div');
  block.className = 'statement';
  block.append(
    paragraph(PRIVACY_TEXT.when, 'muted'),
    paragraph(PRIVACY_TEXT.judgement, 'muted'),
    paragraph(PRIVACY_TEXT.retention, 'muted'),
    paragraph(PRIVACY_TEXT.control, 'muted'),
  );
  return block;
}

/**
 * 把自身高度报给浮窗。
 *
 * 跨源文档之间量不到对方的高度，只能自己报；浮窗据此决定给这块地方留多高。
 * 报给谁要指名道姓：用父页面的来源当目标，拿不到就不发——浮窗那边会走兜底提示，
 * 总好过发给一个不确定的对象。
 */
function reportHeight(): void {
  if (!embedded || window.parent === window) {
    return;
  }

  const parentOrigin = location.ancestorOrigins[0];
  if (parentOrigin === undefined) {
    return;
  }

  window.parent.postMessage(
    { type: 'autoOpenHeight', height: Math.ceil(document.body.getBoundingClientRect().height) },
    parentOrigin,
  );
}

/**
 * 请求这个站点的 host 权限。
 *
 * 这必须是点击处理器里的第一件事：Chrome 只认用户手势，挪到任何 await 之后都会失败。
 */
function requestPermission(origin: string): void {
  void chrome.permissions
    .request({ origins: [permissionPatternOf(origin)] })
    .then((granted) => (granted ? grant(origin) : refuse()));
}

async function grant(origin: string): Promise<void> {
  await addAutoOpenOrigin(origin);
  render();
}

async function revoke(origin: string): Promise<void> {
  await disableAutoOpen(origin);
  render();
}

function refuse(): void {
  notice = '没有授权，读空气不会自动打开。';
  render();
}

function createSiteList(origins: string[]): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'sites';

  for (const origin of origins) {
    const item = document.createElement('li');
    item.className = 'site';

    const label = document.createElement('span');
    label.textContent = origin;

    item.append(label, action('关闭', 'plain', () => void revoke(origin)));
    list.append(item);
  }
  return list;
}

function app(): HTMLElement {
  const element = document.querySelector<HTMLElement>('#app');
  if (element === null) {
    throw new Error('设置页缺少 #app 容器');
  }
  return element;
}

function heading(text: string): HTMLElement {
  const element = document.createElement('h1');
  element.textContent = text;
  return element;
}

function paragraph(text: string, className = ''): HTMLElement {
  const element = document.createElement('p');
  element.textContent = text;
  element.className = className;
  return element;
}

/** 一行：左边是这段设置的说明，右边是它的动作。只有一个子元素时它自然靠左。 */
function row(...children: HTMLElement[]): HTMLElement {
  const element = document.createElement('div');
  element.className = 'row';
  element.append(...children);
  return element;
}

function action(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = label;
  button.className = className;
  button.addEventListener('click', onClick);
  return button;
}

/**
 * 开关。
 *
 * 状态是一眼看得见的事（蓝开灰关），所以不必在"开启/关闭"这类动词上做反推；
 * 标签也可以安心写"这段设置是什么"，不必和按钮的动词打架。
 */
function toggle(checked: boolean, label: string, onToggle: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'switch';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-checked', String(checked));
  button.setAttribute('aria-label', label);

  const knob = document.createElement('span');
  knob.className = 'knob';
  button.append(knob);

  button.addEventListener('click', onToggle);
  return button;
}

function appendNotice(card: HTMLElement): void {
  if (notice === null) {
    return;
  }
  card.append(paragraph(notice, 'notice'));
  notice = null;
}

if (embedded) {
  document.body.classList.add('embed');
}

render();

import {
  addAutoOpenOrigin,
  isAutoOpenEnabled,
  listAutoOpenOrigins,
  permissionPatternOf,
  removeAutoOpenOrigin,
} from '../shared/auto-open';

/**
 * 授权页面。
 *
 * 请求 host 权限必须在用户手势里进行，而内容脚本没有 chrome.permissions，
 * 所以"按网站授权"这件事只能落在扩展自己的页面上。两种进入方式：
 * 从浮窗底部那一行进来时带着站点标识，直接打开设置页时列出已开启的网站。
 */

/** 从浮窗进来时带的站点标识；为空表示用户自己打开了设置页。 */
const site = new URLSearchParams(location.search).get('origin');

/** 上一次操作的反馈。显示过一次就清掉，免得下次重画又冒出来。 */
let notice: string | null = null;

/** 重画当前视图：从浮窗进来的站点视图，或用户自己打开时的已开启列表。 */
function render(): void {
  if (site === null) {
    void renderSiteList();
    return;
  }
  void renderSite(site);
}

async function renderSite(origin: string): Promise<void> {
  const enabled = await isAutoOpenEnabled(origin);

  const card = document.createElement('div');
  card.append(heading('读空气'), paragraph(`进入 ${origin} 的页面时自动打开浮窗。`));

  const hint = enabled
    ? '不想让它自动打开时，关掉即可。'
    : '开启后，进入这个网站的页面会自动读一次空气。';
  const button = enabled
    ? action('关闭', 'plain', () => void revoke(origin))
    : action('开启', '', () => requestPermission(origin));

  card.append(row(hint, button));

  app().replaceChildren(card);
  appendNotice(card);
}

async function renderSiteList(): Promise<void> {
  const origins = await listAutoOpenOrigins();

  const card = document.createElement('div');
  card.append(heading('读空气'));

  if (origins.length === 0) {
    card.append(
      paragraph('还没有开启任何网站。'),
      paragraph('在网站页面上点浮窗底部的「进入本站时自动打开」即可开启。', 'muted'),
    );
  } else {
    card.append(paragraph('进入这些网站时会自动打开浮窗：', 'muted'), createSiteList(origins));
  }

  app().replaceChildren(card);
  appendNotice(card);
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
  // 这一页是从浮窗那一行拐出来的，办完就回去，不把用户留在设置页
  await closeSelf();
}

async function revoke(origin: string): Promise<void> {
  await removeAutoOpenOrigin(origin);
  await chrome.permissions.remove({ origins: [permissionPatternOf(origin)] });
  render();
}

function refuse(): void {
  notice = '没有授权，读空气不会自动打开。';
  render();
}

/** 关掉当前标签页。授权页是扩展自己开出来的，用户不该再手动收拾它。 */
async function closeSelf(): Promise<void> {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id !== undefined) {
    await chrome.tabs.remove(tab.id);
  }
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

function row(hint: string, button: HTMLButtonElement): HTMLElement {
  const element = document.createElement('div');
  element.className = 'row';
  element.append(paragraph(hint, 'muted'), button);
  return element;
}

function action(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = label;
  button.className = className;
  button.addEventListener('click', onClick);
  return button;
}

function appendNotice(card: HTMLElement): void {
  if (notice === null) {
    return;
  }
  card.append(paragraph(notice, 'notice'));
  notice = null;
}

render();

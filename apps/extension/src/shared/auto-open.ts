/**
 * "进入网站时自动打开"的授权名单。
 *
 * 名单单独记在 storage 里，而不是每次去读已授权的 host 权限：内容脚本拿不到
 * chrome.permissions，却要据此决定浮窗上那个设置图标的状态；storage 的变更通知
 * 也正好当"授权变了"的信号用。
 */

/** storage 键名。后台、内容脚本与授权页面共用同一份。 */
const STORAGE_KEY = 'autoOpenOrigins';

/** 站点标识对应的权限匹配模式：从 origin 到 match pattern 只差一段路径。 */
export function permissionPatternOf(origin: string): string {
  return `${origin}/*`;
}

/** 取出 http(s) 的站点标识；其他协议（chrome://、about:、扩展页面）没有授权的意义。 */
export function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** 已开启自动打开的站点，按开启顺序排列。 */
export async function listAutoOpenOrigins(): Promise<string[]> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const value: unknown = stored[STORAGE_KEY];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export async function isAutoOpenEnabled(origin: string): Promise<boolean> {
  return (await listAutoOpenOrigins()).includes(origin);
}

export async function addAutoOpenOrigin(origin: string): Promise<void> {
  const origins = await listAutoOpenOrigins();
  if (origins.includes(origin)) {
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: [...origins, origin] });
}

/**
 * 关掉一个站点的自动打开：名单里去掉，访问权限也还回去。
 *
 * 开启做不到这样合并——请求权限必须在用户手势里发起，只能由页面自己调，
 * 所以"开启"是页面分两步写的，"关闭"没有这个限制，就收在这里。
 */
export async function disableAutoOpen(origin: string): Promise<void> {
  const origins = await listAutoOpenOrigins();
  await chrome.permissions.remove({ origins: [permissionPatternOf(origin)] });
  await chrome.storage.local.set({
    [STORAGE_KEY]: origins.filter((item) => item !== origin),
  });
}

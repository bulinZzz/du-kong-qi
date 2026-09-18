/**
 * 隐私说明说过没有。
 *
 * 说明的内容会离开浏览器这件事，只在它第一次发生时值得说：那时用户还不知道"读空气"
 * 意味着页面文字要出本机。之后它是常识，每次分析都重说一遍就成了打扰。
 *
 * 记在 local 而不是 session：会话存储随浏览器关闭清空，那样每开一次浏览器都要再说一次；
 * 也不能并进 panel-state，那里记的是浮窗这一次的样子，与"用户知道过什么"不是一回事。
 */
const KEY = 'privacyNoticeShown';

/**
 * 取走一次说明的机会：返回这一次该不该说。
 *
 * 读与写放在一个函数里，是因为"说过"这件事只在对用户说的那一刻成立。拆成两个函数，
 * 将来任何一处只读不写，说明就会变成每次都出现；这里让它没有第二种用法。
 * 存储不可用时返回 false：显示过一次却记不下，会退化成每分析一次说一次，比不说更糟。
 */
export async function takePrivacyNotice(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(KEY);
    if (stored[KEY] === true) {
      return false;
    }
    await chrome.storage.local.set({ [KEY]: true });
    return true;
  } catch (error) {
    console.error('读空气：读取隐私说明状态失败', error);
    return false;
  }
}

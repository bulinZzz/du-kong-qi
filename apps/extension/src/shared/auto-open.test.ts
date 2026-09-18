import { afterEach, describe, expect, it } from 'vitest';
import {
  addAutoOpenOrigin,
  disableAutoOpen,
  isAutoOpenEnabled,
  listAutoOpenOrigins,
  originOf,
  permissionPatternOf,
} from './auto-open';

type Fake = {
  store: Record<string, unknown>;
  removedOrigins: string[][];
};

/**
 * 装一个假的 chrome。
 *
 * 扩展代码从 globalThis 上取 chrome，这里只实现被用到的那几个方法；
 * 断言也就落在"读写哪一份数据、有没有把权限还回去"上。
 */
function installFakeChrome(initial: Record<string, unknown> = {}): Fake {
  const fake: Fake = { store: { ...initial }, removedOrigins: [] };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => (key in fake.store ? { [key]: fake.store[key] } : {}),
        set: async (values: Record<string, unknown>) => {
          Object.assign(fake.store, values);
        },
      },
    },
    permissions: {
      remove: async ({ origins }: { origins: string[] }) => {
        fake.removedOrigins.push(origins);
        return true;
      },
    },
  };

  return fake;
}

afterEach(() => {
  (globalThis as unknown as { chrome?: unknown }).chrome = undefined;
});

describe('站点标识与权限模式', () => {
  it('只认 http(s)，其余返回空', () => {
    expect(originOf('https://www.bilibili.com/video/BV1?x=1')).toBe('https://www.bilibili.com');
    expect(originOf('http://localhost:8080/x')).toBe('http://localhost:8080');
    expect(originOf('chrome-extension://abc/options.html')).toBeNull();
    expect(originOf('about:blank')).toBeNull();
    expect(originOf('不是地址')).toBeNull();
  });

  it('权限模式由站点标识加一段路径', () => {
    expect(permissionPatternOf('https://www.bilibili.com')).toBe('https://www.bilibili.com/*');
  });
});

describe('授权名单', () => {
  it('没存过、或存的不是字符串数组时，当作空名单', async () => {
    installFakeChrome();
    expect(await listAutoOpenOrigins()).toEqual([]);

    installFakeChrome({ autoOpenOrigins: 'https://a.com' });
    expect(await listAutoOpenOrigins()).toEqual([]);

    installFakeChrome({ autoOpenOrigins: ['https://a.com', 42] });
    expect(await listAutoOpenOrigins()).toEqual(['https://a.com']);
  });

  it('开启是追加，且不重复加同一个站点', async () => {
    installFakeChrome();

    await addAutoOpenOrigin('https://a.com');
    await addAutoOpenOrigin('https://b.com');
    await addAutoOpenOrigin('https://a.com');

    expect(await listAutoOpenOrigins()).toEqual(['https://a.com', 'https://b.com']);
    expect(await isAutoOpenEnabled('https://b.com')).toBe(true);
    expect(await isAutoOpenEnabled('https://c.com')).toBe(false);
  });

  it('关闭要同时做两件事：名单去掉，权限还回', async () => {
    const fake = installFakeChrome({ autoOpenOrigins: ['https://a.com', 'https://b.com'] });

    await disableAutoOpen('https://a.com');

    expect(await listAutoOpenOrigins()).toEqual(['https://b.com']);
    expect(fake.removedOrigins).toEqual([['https://a.com/*']]);
  });
});

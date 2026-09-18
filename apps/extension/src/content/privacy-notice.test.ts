import { afterEach, describe, expect, it, vi } from 'vitest';
import { takePrivacyNotice } from './privacy-notice';

type Fake = { store: Record<string, unknown>; broken: boolean };

/** 假 local 存储：broken 用来模拟存储不可用。 */
function installFakeLocal(): Fake {
  const fake: Fake = { store: {}, broken: false };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => {
          if (fake.broken) {
            throw new Error('存储不可用');
          }
          return key in fake.store ? { [key]: fake.store[key] } : {};
        },
        set: async (values: Record<string, unknown>) => {
          if (fake.broken) {
            throw new Error('存储不可用');
          }
          Object.assign(fake.store, values);
        },
      },
    },
  };

  return fake;
}

afterEach(() => {
  (globalThis as unknown as { chrome?: unknown }).chrome = undefined;
});

describe('一次性隐私声明', () => {
  it('第一次取走，并把"说过"记下', async () => {
    const fake = installFakeLocal();

    expect(await takePrivacyNotice()).toBe(true);
    expect(fake.store.privacyNoticeShown).toBe(true);
  });

  it('之后不再取走', async () => {
    installFakeLocal();

    expect(await takePrivacyNotice()).toBe(true);
    expect(await takePrivacyNotice()).toBe(false);
  });

  it('存储里已经记过时不显示', async () => {
    installFakeLocal();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: async () => ({ privacyNoticeShown: true }),
          set: async () => {
            throw new Error('不该再写一次');
          },
        },
      },
    };

    expect(await takePrivacyNotice()).toBe(false);
  });

  it('存储不可用时宁可不显示：显示过却记不下，会退化成每次都说', async () => {
    const fake = installFakeLocal();
    fake.broken = true;
    // 这条路径本来就要记一条错误日志，测试里不必让它出现在输出里
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await takePrivacyNotice()).toBe(false);
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { cacheAnalysis, readCachedAnalysis } from './analysis-cache';
import type { AnalysisOutcome } from '../shared/protocol';

type Fake = { store: Record<string, unknown>; broken: boolean };

/** 假会话存储：只实现被用到的读与写；broken 用来模拟存储不可用。 */
function installFakeSession(): Fake {
  const fake: Fake = { store: {}, broken: false };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      session: {
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

const OK: AnalysisOutcome = {
  status: 'ok',
  analysis: {
    flameIntensity: 42,
    level: 'DEBATING',
    summary: '两派在吵',
    evidence: ['甲说乙不懂'],
    confidence: 0.75,
  },
};

afterEach(() => {
  (globalThis as unknown as { chrome?: unknown }).chrome = undefined;
});

describe('一次分析结论的会话缓存', () => {
  it('同一段内容读得回来', async () => {
    installFakeSession();

    await cacheAnalysis('甲说乙不懂，乙说甲跑题。', OK);

    expect(await readCachedAnalysis('甲说乙不懂，乙说甲跑题。')).toEqual(OK);
  });

  it('没存过的内容当作没有', async () => {
    installFakeSession();

    await cacheAnalysis('这一段的讨论内容。', OK);

    expect(await readCachedAnalysis('另一段的讨论内容。')).toBeNull();
  });

  it('内容太少也记：同样的内容再问一次还是同一句话', async () => {
    installFakeSession();
    const outcome: AnalysisOutcome = { status: 'failed', reason: 'insufficientContent' };

    await cacheAnalysis('只有几个字。', outcome);

    expect(await readCachedAnalysis('只有几个字。')).toEqual(outcome);
  });

  it('暂时性失败不记，免得一次抽风让这个页面整场会话都不再尝试', async () => {
    installFakeSession();

    await cacheAnalysis('一段讨论。', { status: 'failed', reason: 'unavailable' });
    await cacheAnalysis('一段讨论。', { status: 'failed', reason: 'network' });

    expect(await readCachedAnalysis('一段讨论。')).toBeNull();
  });

  it('存进去的形状不认识时当作没有', async () => {
    const fake = installFakeSession();
    // 逐字模拟"扩展升级后读到旧形状"：键名对得上，值不成形
    fake.store['analysis:' + 'x'.repeat(64)] = { status: 'ok', analysis: { flameIntensity: '42' } };

    expect(await readCachedAnalysis('随便一段内容。')).toBeNull();
  });

  it('存储不可用时读与写都不抛错', async () => {
    const fake = installFakeSession();
    fake.broken = true;

    await expect(cacheAnalysis('一段讨论。', OK)).resolves.toBeUndefined();
    expect(await readCachedAnalysis('一段讨论。')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { isAtmosphereAnalysis } from './protocol';

const VALID = {
  flameIntensity: 42,
  level: 'DEBATING',
  summary: '两派在吵',
  evidence: ['甲说乙不懂', '乙说甲跑题'],
  confidence: 0.75,
};

describe('后端返回体的校验', () => {
  it('认得一份完整的结果', () => {
    expect(isAtmosphereAnalysis(VALID)).toBe(true);
  });

  it('缺字段就不认', () => {
    const { summary, ...missing } = VALID;

    expect(isAtmosphereAnalysis(missing)).toBe(false);
  });

  it('陌生的等级代码不认', () => {
    expect(isAtmosphereAnalysis({ ...VALID, level: 'UNKNOWN' })).toBe(false);
  });

  it('依据必须是字符串数组', () => {
    expect(isAtmosphereAnalysis({ ...VALID, evidence: [1, 2] })).toBe(false);
    expect(isAtmosphereAnalysis({ ...VALID, evidence: '甲说乙不懂' })).toBe(false);
  });

  it('分数不是数字不认', () => {
    expect(isAtmosphereAnalysis({ ...VALID, flameIntensity: '42' })).toBe(false);
  });

  it('非对象一律不认', () => {
    expect(isAtmosphereAnalysis(null)).toBe(false);
  });
});

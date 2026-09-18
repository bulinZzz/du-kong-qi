import { describe, expect, it } from 'vitest';
import {
  type DiscussionSnapshot,
  hasContentChanged,
  hasContentReplaced,
  hasPageChanged,
} from './watch';

/**
 * 造一个快照。
 *
 * 真实快照的行来自页面文本，比对只看行集合，所以这里直接给行即可。
 */
function snapshot(path: string, lines: string[]): DiscussionSnapshot {
  return { path, lines: new Set(lines) };
}

/** 一行足够长的评论，避免和"只比够长的行"那条规则混淆。 */
function line(index: number): string {
  return `第 ${index} 条评论：这个方案我觉得不太行，理由有成本与维护两点。`;
}

function lines(count: number, from = 0): string[] {
  return Array.from({ length: count }, (_, index) => line(from + index));
}

describe('换页判断', () => {
  it('路径不同才算换页', () => {
    const before = snapshot('/video/BV1', lines(5));
    const after = snapshot('/video/BV2', lines(5));

    expect(hasPageChanged(before, after)).toBe(true);
    expect(hasPageChanged(before, snapshot('/video/BV1', lines(9, 100)))).toBe(false);
  });
});

describe('内容变多', () => {
  it('旧行都在、新增够多时才提示重算', () => {
    const before = snapshot('/', lines(30));
    const grew = snapshot('/', [...lines(30), ...lines(10, 100)]);

    expect(hasContentChanged(before, grew)).toBe(true);
  });

  it('只多出零星几条不算变化', () => {
    const before = snapshot('/', lines(30));
    const grew = snapshot('/', [...lines(30), ...lines(2, 100)]);

    expect(hasContentChanged(before, grew)).toBe(false);
  });

  it('小页面靠比例触发：新增占当前行数的两成', () => {
    const before = snapshot('/', lines(10));
    const grew = snapshot('/', [...lines(10), ...lines(3, 100)]);

    expect(hasContentChanged(before, grew)).toBe(true);
  });
});

describe('整段被替换', () => {
  it('评论自然增长不算替换', () => {
    const before = snapshot('/', lines(30));
    const grew = snapshot('/', [...lines(30), ...lines(20, 100)]);

    expect(hasContentReplaced(before, grew)).toBe(false);
  });

  it('被分析那段消失过半就算替换', () => {
    const before = snapshot('/', lines(30));
    const replaced = snapshot('/', [...lines(12, 500), ...lines(30, 100)]);

    expect(hasContentReplaced(before, replaced)).toBe(true);
  });

  it('恰好消失一半仍算替换', () => {
    const before = snapshot('/', lines(10));
    const replaced = snapshot('/', [...lines(5), ...lines(10, 100)]);

    expect(hasContentReplaced(before, replaced)).toBe(true);
  });

  it('空基线不作判断', () => {
    expect(hasContentReplaced(snapshot('/', []), snapshot('/', lines(20, 100)))).toBe(false);
  });
});

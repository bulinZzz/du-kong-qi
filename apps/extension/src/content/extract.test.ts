import { describe, expect, it } from 'vitest';
import { dropUiNoise, expectationFor } from './extract';

describe('站点期望', () => {
  it('每个已适配站点各有自己的讨论容器，子域也算', () => {
    expect(expectationFor('www.bilibili.com')?.selector).toBe('bili-comments');
    expect(expectationFor('www.zhihu.com')?.selector).toBe('#QuestionAnswers-answers');
    expect(expectationFor('zhuanlan.zhihu.com')?.selector).toBe('#QuestionAnswers-answers');
    expect(expectationFor('m.weibo.cn')?.selector).toBe('.comment-content');
  });

  it('桌面微博不在表里：它的评论是虚拟列表，读不到固定的一段', () => {
    expect(expectationFor('weibo.com')).toBeNull();
  });

  it('没适配的站点没有期望，交给通用回退', () => {
    expect(expectationFor('example.com')).toBeNull();
  });
});

describe('界面文字过滤', () => {
  it('丢掉时间：绝对时间与相对时间', () => {
    expect(
      dropUiNoise(['2026-09-17 20:58', '22-09-12 11:33', '2026-09-17', '刚刚', '3分钟前', '2 小时前']),
    ).toEqual([]);
  });

  it('丢掉回复计数与"点击查看"', () => {
    expect(dropUiNoise(['共 59 条回复，点击查看', '共1条回复', '共 12 条回复'])).toEqual([]);
  });

  it('丢掉孤立标点与光秃秃的控件词', () => {
    expect(dropUiNoise(['，', '…', '·', '点击查看', '回复', '展开', '置顶', '最新'])).toEqual([]);
  });

  it('保留讨论本身，包括很短的回复', () => {
    const discussion = [
      '同感',
      '+1',
      '说得对',
      '这事我觉得还得看具体情况，两边说的都有道理。',
    ];

    expect(dropUiNoise(discussion)).toEqual(discussion);
  });

  it('只丢整行匹配的，句子里的这些词不动', () => {
    const discussion = [
      '这条回复很有道理，我一开始也这么想。',
      '我点开看了下，数据其实对不上。',
      '时间是 2026-09-17，那天他还在外地。',
    ];

    expect(dropUiNoise(discussion)).toEqual(discussion);
  });

  it('只丢掉界面行，顺序与其余内容不变', () => {
    expect(
      dropUiNoise(['甲：这个方案不太可行。', '2026-09-17 20:58', '，', '乙：为什么？', '回复']),
    ).toEqual(['甲：这个方案不太可行。', '乙：为什么？']);
  });

  it('整段都是界面文字时返回空：调用方据此判为没读到', () => {
    expect(dropUiNoise(['最新', '按热度', '共 3 条回复，点击查看'])).toEqual([]);
  });
});

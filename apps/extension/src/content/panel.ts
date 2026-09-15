import type { AnalysisFailureReason, AtmosphereAnalysis } from '../shared/protocol';

/** 浮窗要展示的内容。 */
export type PanelView =
  | { kind: 'loading'; phase: 'readingComments' | 'analyzing' }
  | { kind: 'result'; analysis: AtmosphereAnalysis }
  | { kind: 'failure'; reason: AnalysisFailureReason }
  | { kind: 'empty'; retried: boolean };

/** 浮窗上的操作：渲染层只负责触发，具体行为由内容脚本决定。 */
export type PanelActions = {
  /** 兜底按钮的动作：滚到讨论区再读一次 */
  readDiscussion: () => void;
};

/** 加载体现在两个阶段：评论要读，空气要判，等待时长都不短。 */
const LOADING_TEXTS = {
  readingComments: '正在读评论区…',
  analyzing: '正在判断空气…',
};

type AtmosphereLevel = AtmosphereAnalysis['level'];

/** 后端只给等级代码，这里翻成给用户看的措辞。 */
const LEVEL_LABELS: Record<AtmosphereLevel, string> = {
  PEACEFUL: '基本平和',
  REASONABLE: '还算理性',
  DEBATING: '争论明显',
  HOSTILE: '对立明显',
  FIERCE: '骂战激烈',
};

/**
 * 失败文案。
 *
 * "服务不可用"与"网络不通"对用户是同一件事——都是过会儿再试——所以合并成一句；
 * 内部分得清就够了。
 */
const FAILURE_TEXTS: Record<AnalysisFailureReason, string> = {
  insufficientContent: '这里的内容太少，读不出空气',
  unavailable: '分析服务暂时用不了，过会儿再试',
  network: '分析服务暂时用不了，过会儿再试',
};

/** 依据最多列几条。 */
const MAX_EVIDENCE = 3;

/** 低于这个置信度时补一句提醒；不给用户看具体数值。 */
const LOW_CONFIDENCE = 0.5;

/**
 * 浮窗的渲染入口。
 *
 * 这是唯一与 UI 写法耦合的地方：将来浮窗变复杂、需要引入框架时，替换的是这一层，
 * 正文提取、消息通道与后端调用都不受影响。
 */
export function renderPanel(host: HTMLElement, view: PanelView, actions: PanelActions): void {
  host.replaceChildren(createPanel(view, actions));
}

function createPanel(view: PanelView, actions: PanelActions): HTMLElement {
  const panel = createContainer();
  panel.append(createTitle());

  switch (view.kind) {
    case 'loading':
      panel.append(createLine(LOADING_TEXTS[view.phase], 'opacity: 0.85'));
      break;

    case 'result':
      panel.append(...createResult(view.analysis));
      break;

    case 'failure':
      panel.append(createLine(FAILURE_TEXTS[view.reason], ''));
      break;

    case 'empty':
      panel.append(
        createLine(view.retried ? '还是没读到内容。' : '评论还没加载出来。', ''),
        createLine(
          view.retried
            ? '评论可能要先登录才显示，你也可以自己往下滚一点再点一次。'
            : '这个页面要滚到评论区才会加载，要我去读一下吗？',
          'font-size: 12px; opacity: 0.75',
        ),
        createButton(view.retried ? '再试一次' : '好，去读评论区', actions.readDiscussion),
      );
      break;
  }

  return panel;
}

function createResult(analysis: AtmosphereAnalysis): HTMLElement[] {
  const lines: HTMLElement[] = [
    createLine(
      `${analysis.flameIntensity} · ${LEVEL_LABELS[analysis.level]}`,
      'font-size: 15px; font-weight: 600',
    ),
    createLine(analysis.summary, ''),
  ];

  if (analysis.evidence.length > 0) {
    lines.push(createEvidence(analysis.evidence));
  }
  if (analysis.confidence < LOW_CONFIDENCE) {
    lines.push(createLine('这里的内容不太好判断', 'font-size: 12px; opacity: 0.75'));
  }

  return lines;
}

/** 依据做成列表：三条以内的短句比一段话更容易扫过去。 */
function createEvidence(evidence: string[]): HTMLElement {
  const list = document.createElement('ul');
  list.style.cssText = 'margin: 0 0 6px; padding-left: 18px; font-size: 12px; opacity: 0.85';

  for (const item of evidence.slice(0, MAX_EVIDENCE)) {
    const entry = document.createElement('li');
    entry.textContent = item;
    list.append(entry);
  }
  return list;
}

function createContainer(): HTMLElement {
  const panel = document.createElement('section');
  panel.style.cssText = [
    'position: fixed',
    'top: 16px',
    'right: 16px',
    'z-index: 2147483647',
    'width: 280px',
    'padding: 12px 14px',
    'border-radius: 10px',
    'background: #1f2430',
    'color: #f5f6f8',
    'font: 13px/1.6 system-ui, sans-serif',
    'box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28)',
  ].join(';');
  return panel;
}

function createTitle(): HTMLElement {
  return createLine('读空气', 'font-weight: 600');
}

function createLine(text: string, extraStyle: string): HTMLElement {
  const line = document.createElement('div');
  line.textContent = text;
  line.style.cssText = `margin-bottom: 6px;${extraStyle}`;
  return line;
}

function createButton(label: string, onClick: () => void): HTMLElement {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.cssText = [
    'margin-top: 4px',
    'padding: 6px 10px',
    'border: none',
    'border-radius: 6px',
    'background: #4c7dff',
    'color: #fff',
    'font: inherit',
    'cursor: pointer',
  ].join(';');
  button.addEventListener('click', onClick);
  return button;
}

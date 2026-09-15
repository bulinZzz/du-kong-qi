/** 浮窗要展示的内容。 */
export type PanelView =
  | { kind: 'loading' }
  | { kind: 'extracted'; charCount: number; preview: string }
  | { kind: 'empty'; retried: boolean };

/** 浮窗上的操作：渲染层只负责触发，具体行为由内容脚本决定。 */
export type PanelActions = {
  /** 兜底按钮的动作：滚到讨论区再读一次 */
  readDiscussion: () => void;
};

/** 预览里最多展示的字数。 */
const PREVIEW_LENGTH = 200;

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
  panel.append(createTitle());

  if (view.kind === 'loading') {
    panel.append(createLine('正在读评论区…', 'opacity: 0.85'));
    return panel;
  }

  if (view.kind === 'extracted') {
    panel.append(createLine(`已抓到 ${view.charCount} 字`, ''), createPreview(view.preview));
    return panel;
  }

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

function createPreview(text: string): HTMLElement {
  const preview = document.createElement('div');
  preview.textContent = text.slice(0, PREVIEW_LENGTH);
  preview.style.cssText = [
    'max-height: 140px',
    'overflow: auto',
    'padding: 8px',
    'border-radius: 6px',
    'background: rgba(255, 255, 255, 0.06)',
    'font-size: 12px',
    'line-height: 1.5',
    'white-space: pre-wrap',
    'word-break: break-word',
    'opacity: 0.85',
  ].join(';');
  return preview;
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

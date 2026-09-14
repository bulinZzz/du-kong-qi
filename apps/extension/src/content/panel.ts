/**
 * 浮窗的渲染入口。
 *
 * 这是唯一与 UI 写法耦合的地方：将来浮窗变复杂、需要引入框架时，替换的是这一层，
 * 正文提取、消息通道与后端调用都不受影响。
 */
export function renderPanel(host: HTMLElement): void {
  host.replaceChildren(createPanel());
}

function createPanel(): HTMLElement {
  const panel = document.createElement('section');
  panel.style.cssText = [
    'position: fixed',
    'top: 16px',
    'right: 16px',
    'z-index: 2147483647',
    'width: 240px',
    'padding: 12px 14px',
    'border-radius: 10px',
    'background: #1f2430',
    'color: #f5f6f8',
    'font: 13px/1.6 system-ui, sans-serif',
    'box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28)',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = '读空气';
  title.style.cssText = 'font-weight: 600; margin-bottom: 6px';

  const hint = document.createElement('div');
  hint.textContent = '浮窗骨架已就位，尚未接入分析。';
  hint.style.cssText = 'opacity: 0.75';

  panel.append(title, hint);
  return panel;
}

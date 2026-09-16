import type { AnalysisFailureReason, AtmosphereAnalysis } from '../shared/protocol';

/** 浮窗要展示的内容。 */
export type PanelView =
  | { kind: 'loading'; phase: 'readingComments' | 'analyzing' }
  | { kind: 'result'; analysis: AtmosphereAnalysis; expired: boolean }
  | { kind: 'failure'; reason: AnalysisFailureReason }
  | { kind: 'pageChanged' }
  | { kind: 'empty'; retried: boolean };

/** 浮窗上的操作：渲染层只负责触发，具体行为由内容脚本决定。 */
export type PanelActions = {
  /** 兜底按钮的动作：滚到讨论区再读一次 */
  readDiscussion: () => void;
  /** 结果过期或换页后的重新分析 */
  reanalyze: () => void;
  /** 关掉浮窗，并让内容脚本停掉页面变化的轮询 */
  close: () => void;
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
 * 结果作废时的提示。
 *
 * 同页内容变化时保留上一次的分数——它没有错，只是样本变了；
 * 整页换掉时不给旧分数——那个分数与当前页面的讨论毫无关系。
 */
const EXPIRED_NOTE = '讨论有新变化，要重算吗？';
const PAGE_CHANGED_NOTE = '页面换过了，要重新分析吗？';
const REANALYZE_LABEL = '重新分析';

/** 浮窗尺寸与贴边留白。上限不设常量：跟屏幕走，用户不该撞到一个数字上。 */
const DEFAULT_PANEL_WIDTH = 280;
/**
 * 下限只保一件事：标题栏上的两个按钮还够得着。
 *
 * 它不是可读性的下限——用户想把窗口压细，多半是因为它挡了页面上的东西，
 * 这时候他在意的是窗口有多小，不是窗口里的字好不好读。
 */
const MIN_PANEL_WIDTH = 80;
const MIN_PANEL_HEIGHT = 56;
const PANEL_MARGIN = 16;
const CHIP_SIZE = 56;

/** 缩放热区的厚度：边 6px，角 12px。 */
const EDGE_SIZE = 6;
const CORNER_SIZE = 12;

/** 按住后移动超过这个距离才算拖动，否则当成一次点击。 */
const DRAG_THRESHOLD = 4;

/**
 * 浮窗的表面质感：深色毛玻璃。
 *
 * 面板与圆片共用同一套，收起前后看起来是同一个东西。
 * 半透明必须配描边与模糊：没有描边，它在浅色页面上会糊成一片。
 */
const SURFACE = [
  'background: linear-gradient(160deg, rgba(40, 46, 61, 0.86), rgba(22, 26, 35, 0.9))',
  'backdrop-filter: blur(12px) saturate(1.15)',
  'border: 1px solid rgba(255, 255, 255, 0.1)',
  'color: #f5f6f8',
].join(';');

type PanelPosition = { left: number; top: number };

/**
 * 浮窗的位置与折叠状态。
 *
 * 面板每次状态变化都会整体重建，这些不能跟着丢，所以放在模块状态里，每次渲染时套回去。
 */
let position: PanelPosition | null = null;
let minimized = false;

/** 面板尺寸：宽度默认 280，高度默认交给内容。用户拖过之后才固定下来。 */
let panelWidth = DEFAULT_PANEL_WIDTH;
let panelHeight: number | null = null;

/** 上一次渲染的输入：折叠与展开时就地重画，不需要内容脚本再喊一次。 */
let host: HTMLElement | null = null;
let lastView: PanelView | null = null;
let lastActions: PanelActions | null = null;

/** 拖动时与折叠状态一起记的"刚刚拖过"标记：拖动末尾的那次 click 要吃掉。 */
let dragged = false;

/** viewport 变化时的兜底观察者：窗口变小后浮窗不该停在屏幕外。 */
let viewportObserver: ResizeObserver | null = null;

/**
 * 浮窗的渲染入口。
 *
 * 这是唯一与 UI 写法耦合的地方：将来浮窗变复杂、需要引入框架时，替换的是这一层，
 * 正文提取、消息通道与后端调用都不受影响。
 */
export function renderPanel(target: HTMLElement, view: PanelView, actions: PanelActions): void {
  host = target;
  lastView = view;
  lastActions = actions;
  paint();
}

function paint(): void {
  if (host === null || lastView === null || lastActions === null) {
    return;
  }

  const element = minimized ? createChip(lastView) : createPanel(lastView, lastActions);
  host.replaceChildren(element);
  place(element, minimized ? CHIP_SIZE : panelWidth);
  watchViewport();
}

/** 位置先落在右上角，之后跟着用户拖到哪儿算哪儿。 */
function place(element: HTMLElement, fallbackWidth: number): void {
  const start = position ?? {
    left: window.innerWidth - fallbackWidth - PANEL_MARGIN,
    top: PANEL_MARGIN,
  };

  position = clampToViewport(start, element);
  element.style.left = `${position.left}px`;
  element.style.top = `${position.top}px`;
}

function clampToViewport(point: PanelPosition, element: HTMLElement): PanelPosition {
  const width = element.offsetWidth || DEFAULT_PANEL_WIDTH;
  const height = element.offsetHeight || CHIP_SIZE;

  return {
    left: Math.min(Math.max(point.left, 0), Math.max(window.innerWidth - width, 0)),
    top: Math.min(Math.max(point.top, 0), Math.max(window.innerHeight - height, 0)),
  };
}

function watchViewport(): void {
  viewportObserver?.disconnect();
  viewportObserver = new ResizeObserver(() => {
    const element = host?.firstElementChild;
    if (!(element instanceof HTMLElement) || position === null) {
      return;
    }
    position = clampToViewport(position, element);
    element.style.left = `${position.left}px`;
    element.style.top = `${position.top}px`;
  });
  viewportObserver.observe(document.documentElement);
}

function createPanel(view: PanelView, actions: PanelActions): HTMLElement {
  const panel = createContainer();
  const body = createBody();
  const header = createHeader(actions);
  enableDrag(panel, header);
  panel.append(header, body);

  switch (view.kind) {
    case 'loading':
      body.append(createLine(LOADING_TEXTS[view.phase], 'opacity: 0.85'));
      break;

    case 'result':
      body.append(...createResult(view.analysis));
      if (view.expired) {
        body.append(
          createLine(EXPIRED_NOTE, 'font-size: 13px; opacity: 0.75'),
          createButton(REANALYZE_LABEL, actions.reanalyze),
        );
      }
      break;

    case 'pageChanged':
      body.append(
        createLine(PAGE_CHANGED_NOTE, ''),
        createButton(REANALYZE_LABEL, actions.reanalyze),
      );
      break;

    case 'failure':
      body.append(createLine(FAILURE_TEXTS[view.reason], ''));
      break;

    case 'empty':
      body.append(
        createLine(view.retried ? '还是没读到内容。' : '评论还没加载出来。', ''),
        createLine(
          view.retried
            ? '评论可能要先登录才显示，你也可以自己往下滚一点再点一次。'
            : '这个页面要滚到评论区才会加载，要我去读一下吗？',
          'font-size: 13px; opacity: 0.75',
        ),
        createButton(view.retried ? '再试一次' : '好，去读评论区', actions.readDiscussion),
      );
      break;
  }

  panel.append(...createResizeHandles(panel));
  return panel;
}

/** 折叠成一枚圆片：顺手把分数摆在上面，收起也能看到读数。 */
function createChip(view: PanelView): HTMLElement {
  const chip = document.createElement('button');
  chip.textContent = view.kind === 'result' ? String(view.analysis.flameIntensity) : '空气';
  chip.title = '展开读空气';
  chip.style.cssText = [
    SURFACE,
    // 与面板一样是浮在页面上的固定定位，少了它 left/top 不会生效
    'position: fixed',
    'z-index: 2147483647',
    `width: ${CHIP_SIZE}px`,
    `height: ${CHIP_SIZE}px`,
    'padding: 0',
    'border-radius: 50%',
    'font: 600 18px/1 system-ui, sans-serif',
    'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32)',
    'cursor: pointer',
  ].join(';');

  // 展开走 click，不走指针事件：键盘回车也要能展开
  chip.addEventListener('click', () => {
    if (dragged) {
      dragged = false;
      return;
    }
    minimized = false;
    paint();
  });
  enableDrag(chip, chip);
  return chip;
}

/** 可以拖的方向：四条边与四个角。 */
type ResizeEdge =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight';

const RESIZE_HANDLES: ReadonlyArray<{ edge: ResizeEdge; cursor: string; box: string }> = [
  {
    edge: 'top',
    cursor: 'ns-resize',
    box: `left: ${CORNER_SIZE}px; right: ${CORNER_SIZE}px; top: 0; height: ${EDGE_SIZE}px`,
  },
  {
    edge: 'bottom',
    cursor: 'ns-resize',
    box: `left: ${CORNER_SIZE}px; right: ${CORNER_SIZE}px; bottom: 0; height: ${EDGE_SIZE}px`,
  },
  {
    edge: 'left',
    cursor: 'ew-resize',
    box: `left: 0; top: ${CORNER_SIZE}px; bottom: ${CORNER_SIZE}px; width: ${EDGE_SIZE}px`,
  },
  {
    edge: 'right',
    cursor: 'ew-resize',
    box: `right: 0; top: ${CORNER_SIZE}px; bottom: ${CORNER_SIZE}px; width: ${EDGE_SIZE}px`,
  },
  {
    edge: 'topLeft',
    cursor: 'nwse-resize',
    box: `left: 0; top: 0; width: ${CORNER_SIZE}px; height: ${CORNER_SIZE}px`,
  },
  {
    edge: 'topRight',
    cursor: 'nesw-resize',
    box: `right: 0; top: 0; width: ${CORNER_SIZE}px; height: ${CORNER_SIZE}px`,
  },
  {
    edge: 'bottomLeft',
    cursor: 'nesw-resize',
    box: `left: 0; bottom: 0; width: ${CORNER_SIZE}px; height: ${CORNER_SIZE}px`,
  },
  {
    edge: 'bottomRight',
    cursor: 'nwse-resize',
    box: `right: 0; bottom: 0; width: ${CORNER_SIZE}px; height: ${CORNER_SIZE}px`,
  },
];

/**
 * 四条边与四个角都能拖。
 *
 * 手柄平时透明，指针移到面板上才显形——它们不该破坏浮窗的外观。
 * 拖哪条边，对面的那条边就不动：拖左边时右边缘固定，拖上边时底边固定，这样才像在拉窗口。
 */
function createResizeHandles(panel: HTMLElement): HTMLElement[] {
  return RESIZE_HANDLES.map(({ edge, cursor, box }) => {
    const handle = document.createElement('div');
    handle.style.cssText = [
      'position: absolute',
      box,
      'opacity: 0',
      'transition: opacity 120ms',
      `cursor: ${cursor}`,
      'touch-action: none',
    ].join(';');

    panel.addEventListener('pointerenter', () => {
      handle.style.opacity = '1';
    });
    panel.addEventListener('pointerleave', () => {
      handle.style.opacity = '0';
    });

    enableResize(panel, handle, edge);
    return handle;
  });
}

/**
 * 开始一次指针拖动。
 *
 * 只接左键，把指针锁在这个热区上，松手或取消时把监听摘干净。
 * 拖动浮窗与拖动缩放热区共用这一段：两者除了移动时算什么，其余完全一样。
 */
function beginPointerDrag(
  handle: HTMLElement,
  event: PointerEvent,
  onMove: (moveEvent: PointerEvent) => void,
): void {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  handle.setPointerCapture(event.pointerId);

  const finish = () => {
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', finish);
    handle.removeEventListener('pointercancel', finish);
  };

  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
}

function enableResize(panel: HTMLElement, handle: HTMLElement, edge: ResizeEdge): void {
  handle.addEventListener('pointerdown', (event) => {
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = panel.getBoundingClientRect();
    const startWidth = panelWidth;
    // 高度可能还是内容撑出来的，所以从当前实际高度量起
    const startHeight = startRect.height;
    const startLeft = position?.left ?? startRect.left;
    const startTop = position?.top ?? startRect.top;

    beginPointerDrag(handle, event, (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      // 拖哪条边，对面那条边不动；两个方向各自算出新的左上角
      let left = startLeft;
      let top = startTop;

      if (edge === 'left' || edge === 'topLeft' || edge === 'bottomLeft') {
        // 右边缘不动：宽度少了多少，左边就往右挪多少
        panelWidth = clampWidth(startWidth - dx);
        left = startLeft + (startWidth - panelWidth);
      } else if (edge === 'right' || edge === 'topRight' || edge === 'bottomRight') {
        panelWidth = clampWidth(startWidth + dx);
      }

      if (edge === 'top' || edge === 'topLeft' || edge === 'topRight') {
        // 底边不动：高度往上长多少，顶边就往上挪多少，到屏幕顶部为止
        const bottom = startTop + startHeight;
        panelHeight = Math.round(Math.min(Math.max(startHeight - dy, MIN_PANEL_HEIGHT), bottom));
        top = bottom - panelHeight;
      } else if (edge === 'bottom' || edge === 'bottomLeft' || edge === 'bottomRight') {
        panelHeight = clampHeight(startHeight + dy, startTop);
      }

      position = { left, top };
      applySize(panel);
    });
  });
}

/** 尺寸变化后统一落一次：宽高，以及越界时的位置修正。 */
function applySize(panel: HTMLElement): void {
  panel.style.width = `${panelWidth}px`;
  if (panelHeight !== null) {
    panel.style.height = `${panelHeight}px`;
  }

  if (position !== null) {
    // 变宽后可能越过右边缘：把整个面板左移，而不是限制宽度——
    // 面板默认停在右上角，限制宽度会让它连默认宽度都回不去
    position = clampToViewport(position, panel);
    panel.style.left = `${position.left}px`;
    panel.style.top = `${position.top}px`;
  }
}

/**
 * 宽度的上限跟着屏幕走，不是固定的数值。
 *
 * 留出两侧贴边留白后还剩多少就能多宽——用户不该在某个特定数字上撞到墙。
 */
function clampWidth(width: number): number {
  const room = Math.max(window.innerWidth - PANEL_MARGIN * 2, MIN_PANEL_WIDTH);
  return Math.round(Math.min(Math.max(width, MIN_PANEL_WIDTH), room));
}

/** 高度的上限由"顶边到屏幕底部还剩多少"决定，同样跟屏幕走。 */
function clampHeight(height: number, top: number): number {
  const room = Math.max(window.innerHeight - top - PANEL_MARGIN, MIN_PANEL_HEIGHT);
  return Math.round(Math.min(Math.max(height, MIN_PANEL_HEIGHT), room));
}

/**
 * 按住某处拖动浮窗。
 *
 * 展开时只拖标题栏，正文里要能选字、点按钮；折叠时整个圆片都可以拖。
 */
function enableDrag(element: HTMLElement, handle: HTMLElement): void {
  handle.addEventListener('pointerdown', (event) => {
    dragged = false;
    const startX = event.clientX;
    const startY = event.clientY;
    const start = position ?? { left: element.offsetLeft, top: element.offsetTop };

    beginPointerDrag(handle, event, (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!dragged && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) {
        return;
      }
      dragged = true;

      position = clampToViewport({ left: start.left + dx, top: start.top + dy }, element);
      element.style.left = `${position.left}px`;
      element.style.top = `${position.top}px`;
    });
  });
}

function createResult(analysis: AtmosphereAnalysis): HTMLElement[] {
  const lines: HTMLElement[] = [
    createLine(
      `${analysis.flameIntensity} · ${LEVEL_LABELS[analysis.level]}`,
      'font-size: 16px; font-weight: 600',
    ),
    createLine(analysis.summary, ''),
  ];

  if (analysis.evidence.length > 0) {
    lines.push(createEvidence(analysis.evidence));
  }
  if (analysis.confidence < LOW_CONFIDENCE) {
    lines.push(createLine('这里的内容不太好判断', 'font-size: 13px; opacity: 0.75'));
  }

  return lines;
}

/** 依据做成列表：三条以内的短句比一段话更容易扫过去。 */
function createEvidence(evidence: string[]): HTMLElement {
  const list = document.createElement('ul');
  list.style.cssText = 'margin: 0 0 6px; padding-left: 18px; font-size: 13px; opacity: 0.85';

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
    SURFACE,
    'position: fixed',
    // 必须盖在站点自己的浮层之上，否则拖不动也点不着
    'z-index: 2147483647',
    // 纵向排布：标题栏固定，内容区自己滚
    'display: flex',
    'flex-direction: column',
    `width: ${panelWidth}px`,
    panelHeight === null ? '' : `height: ${panelHeight}px`,
    'box-sizing: border-box',
    'padding: 12px 14px',
    'border-radius: 14px',
    'font: 14px/1.6 system-ui, sans-serif',
    'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35)',
  ]
    .filter((rule) => rule !== '')
    .join(';');
  return panel;
}

/**
 * 内容区独立滚动。
 *
 * 面板能被拖矮之后，内容多了要能在里面滚，而不是把标题栏顶出去。
 * `min-height: 0` 是必须的：没有它，flex 子元素不会收缩，也就滚不起来。
 */
function createBody(): HTMLElement {
  const body = document.createElement('div');
  body.style.cssText = 'flex: 1 1 auto; min-height: 0; overflow: auto';
  return body;
}

function createHeader(actions: PanelActions): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText = [
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'margin-bottom: 6px',
    // 不用 cursor: move，它会把指针换成十字箭头；这里保持普通箭头
    'cursor: default',
    'user-select: none',
    'touch-action: none',
  ].join(';');

  const title = document.createElement('span');
  title.textContent = '读空气';
  // 窗口被压得很细时先牺牲标题：它只是名字，两个按钮是真的要能点到
  title.style.cssText =
    'font-weight: 600; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis';

  const minimize = createIconButton('minimize', '收起', () => {
    minimized = true;
    paint();
  });
  const close = createIconButton('close', '关闭', () => {
    // 关闭后下次再点图标应当是展开的面板，所以顺带把折叠状态复位
    minimized = false;
    actions.close();
  });

  const controls = document.createElement('span');
  controls.style.cssText = 'display: flex; gap: 2px; flex: 0 0 auto';
  controls.append(minimize, close);

  header.append(title, controls);
  return header;
}

/** 标题栏上的小按钮：不参与拖动，也不让事件冒泡到页面。 */
function createIconButton(
  kind: 'minimize' | 'close',
  title: string,
  onClick: () => void,
): HTMLElement {
  const button = document.createElement('button');
  button.title = title;
  button.setAttribute('aria-label', title);
  button.style.cssText = [
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'width: 20px',
    'height: 20px',
    'padding: 0',
    'border: none',
    'background: transparent',
    'color: inherit',
    'cursor: pointer',
    'opacity: 0.7',
  ].join(';');

  button.append(createIcon(kind));
  button.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });
  button.addEventListener('click', () => {
    onClick();
  });
  return button;
}

/**
 * 图标用 SVG 画，不用字形。
 *
 * "—"和"×"这类字符的宽度与笔画粗细天生不同，只调字号凑不齐；
 * 同一块画布、同一个线宽画出来的才真的一样大。
 */
function createIcon(kind: 'minimize' | 'close'): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');

  const segments: ReadonlyArray<readonly [number, number, number, number]> =
    kind === 'minimize'
      ? [[3, 8, 13, 8]]
      : [
          [4, 4, 12, 12],
          [12, 4, 4, 12],
        ];

  for (const [x1, y1, x2, y2] of segments) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    svg.append(line);
  }
  return svg;
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

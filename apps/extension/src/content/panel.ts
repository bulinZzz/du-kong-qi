import type { AnalysisFailureReason, AtmosphereAnalysis } from '../shared/protocol';
import { PRIVACY_TEXT } from '../shared/privacy';

/**
 * 浮窗要展示的内容。
 *
 * `privacyNotice` 表示这一次顺带说一次隐私说明。它只挂在真的把文字发出去过的结局上——
 * 拿到了结论，或这次发送失败了；"没读到内容"这种根本没发出请求的状态不带它。
 */
export type PanelView =
  | { kind: 'loading'; phase: 'readingComments' | 'analyzing' }
  | {
      kind: 'result';
      analysis: AtmosphereAnalysis;
      expired: boolean;
      privacyNotice: boolean;
      /** 这次结论读到几条内容、它们叫什么；认不出来的站点为 null。 */
      readItems: { count: number; noun: string } | null;
    }
  | { kind: 'failure'; reason: AnalysisFailureReason; privacyNotice: boolean }
  | { kind: 'pageChanged' }
  | { kind: 'discussionReplaced' }
  | { kind: 'empty'; retried: boolean };

/** 浮窗上的操作：渲染层只负责触发，具体行为由内容脚本决定。 */
export type PanelActions = {
  /** 兜底按钮的动作：滚到讨论区再读一次 */
  readDiscussion: () => void;
  /** 结果过期或换页后的重新分析 */
  reanalyze: () => void;
  /** 关掉浮窗，并让内容脚本停掉页面变化的轮询 */
  close: () => void;
  /** 授权界面（扩展自己的页面）的地址：面板自己不拼扩展地址，只管用 */
  autoOpenFrameUrl: string;
  /** 兜底：面板里嵌不进来时，请后台把授权页单独开出来 */
  openAutoOpenPage: () => void;
  /** 拖动、缩放或收起展开之后，把浮窗现在的样子交出去记下（内容脚本负责存，渲染层不碰 chrome） */
  rememberState: (state: PanelState) => void;
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
 * 同页内容变多时保留上一次的分数——它没有错，只是样本又长了；
 * 整页换掉、或同页里被分析的那批评论整段换掉时，不给旧分数——那个分数与眼前的内容无关。
 */
const EXPIRED_NOTE = '讨论有新变化，要重算吗？';
const PAGE_CHANGED_NOTE = '页面换过了，要重新分析吗？';
/** 换排序、换筛选之后，被分析的那批评论整段不在了。不猜为什么换，只说换了。 */
const DISCUSSION_REPLACED_NOTE = '讨论换了一批，要重新分析吗？';
const REANALYZE_LABEL = '重新分析';

/**
 * 浮窗尺寸与贴边留白。上限不设常量：跟屏幕走，用户不该撞到一个数字上。
 */
const DEFAULT_PANEL_WIDTH = 280;
/**
 * 尺寸下限：小到控件自己装不下为止。
 *
 * 116 = 标题栏上四个 20px 的按钮 + 三个 2px 间隔 + 左右各 14px 内边距 + 左右各 1px 描边；
 * 49 = 标题栏一行 22px（14px 字号 × 1.6）+ 上下各 12px 内边距 + 上下各 1px 描边。
 *
 * 这不是偏好，也不是可读性——用户把窗口压小，多半是因为它挡住了页面上的东西，
 * 这时候他在意的是窗口有多小，不是里面的字好不好读。真正不能越过的只有一条：
 * 几个按钮还得在窗口里，否则用户丢的不是读数，是"回得去"。
 */
const MIN_PANEL_WIDTH = 116;
const MIN_PANEL_HEIGHT = 49;
/** 首屏落点与贴边留白：16px 时右边那条边离页面太近，看着挤，用 24 */
const PANEL_MARGIN = 24;
const CHIP_SIZE = 56;

/** 缩放热区的厚度：边 10px，角 16px。这是"抓得住"与"不占地方"之间的折中。 */
const EDGE_SIZE = 10;
const CORNER_SIZE = 16;

/** 按住后移动超过这个距离才算拖动，否则当成一次点击。 */
const DRAG_THRESHOLD = 4;

/** 已开启自动打开的站点，设置图标用这个颜色：压在深色玻璃上对比度约 7:1。 */
const ACTIVE_ICON_COLOR = '#8ab0ff';

/** 授权界面嵌进来之后，等它自报高度的时间；等不到就当这一页不允许嵌扩展页面。 */
const EDITOR_TIMEOUT_MS = 1000;

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

/**
 * 影子根里的一份样式表。
 *
 * 浮窗的样式几乎都在元素上，只有这几样写不进内联：伪元素（滚动条、文字选中）与悬停态。
 * 页面自己的样式进不来影子根，所以这里不必考虑被覆盖。
 */
const PANEL_STYLE = [
  // 内容区滚动条：系统那一条压在深色玻璃上很扎眼
  '.panel-body { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.22) transparent }',
  '.panel-body::-webkit-scrollbar { width: 8px; height: 8px }',
  '.panel-body::-webkit-scrollbar-track { background: transparent }',
  '.panel-body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.22); border-radius: 4px }',
  '.panel-body::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.32) }',
  // 选中色：默认那片蓝压在深色底上太跳
  '::selection { background: rgba(90, 130, 255, 0.4) }',
  // 缩放热区：平时透明，指针压上去才显出一条边，让人知道这里能拖
  '.resize-edge { opacity: 0; transition: opacity 120ms }',
  '.resize-edge:hover { opacity: 1; background: rgba(255, 255, 255, 0.14) }',
].join('\n');

/** 浮窗在视口里的落点。 */
export type PanelPosition = { left: number; top: number };

/**
 * 浮窗这一次的样子：落在哪儿、是展开的面板还是收起的圆片。
 *
 * 两者一起记、一起读：它们共同回答"这个窗口现在什么样"，而尺寸不在此列——
 * 尺寸每次回到默认（见开发记录）。
 */
export type PanelState = { position: PanelPosition | null; minimized: boolean };

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

/** 本站在不在"进入时自动打开"的名单里：设置图标据此染色。 */
let autoOpen = false;

/**
 * 设置区：展开时面板里嵌着扩展自己的授权界面。
 *
 * 它要等嵌入页面把高度报回来才知道该留多高；报不回来就说明这一页不允许嵌，
 * 改用后台单独开出来的页面（见 createAutoOpenEditor）。
 */
let autoOpenEditor = false;
let editorHeight: number | null = null;
let editorFailed = false;
let editorHandler: ((event: MessageEvent) => void) | null = null;
let editorTimer: number | null = null;

/** 上一次渲染的输入：折叠与展开时就地重画，不需要内容脚本再喊一次。 */
let host: PanelTarget | null = null;
let lastView: PanelView | null = null;
let lastActions: PanelActions | null = null;

/** 当前画出来的那个元素：视口变化时要拿它量尺寸，比从 DOM 里翻更直接。 */
let rendered: HTMLElement | null = null;

/** 拖动时与折叠状态一起记的"刚刚拖过"标记：拖动末尾的那次 click 要吃掉。 */
let dragged = false;

/** viewport 变化时的兜底观察者：窗口变小后浮窗不该停在屏幕外。 */
let viewportObserver: ResizeObserver | null = null;

/** 浮窗画在哪：宿主元素的影子根，或宿主元素本身。 */
export type PanelTarget = Element | ShadowRoot;

/**
 * 浮窗的渲染入口。
 *
 * 这是唯一与 UI 写法耦合的地方：将来浮窗变复杂、需要引入框架时，替换的是这一层，
 * 正文提取、消息通道与后端调用都不受影响。
 */
export function renderPanel(target: PanelTarget, view: PanelView, actions: PanelActions): void {
  host = target;
  lastView = view;
  lastActions = actions;
  paint();
}

/**
 * 告知本站的自动打开状态。
 *
 * 它属于浮窗外围的开关，不属于浮窗要展示的内容，所以单独进来；变了就地重画一次。
 */
export function setAutoOpen(enabled: boolean): void {
  if (autoOpen === enabled) {
    return;
  }
  autoOpen = enabled;
  paint();
}

/**
 * 套用记下来的样子。
 *
 * 在浮窗画出来之前套用，就不会看到跳动；越界由渲染时的夹取兜住。
 * 用户在这次页面里已经动过手（位置被改过）就不覆盖他。
 */
export function restorePanelState(state: PanelState): void {
  if (position !== null) {
    return;
  }
  position = state.position;
  minimized = state.minimized;
  paint();
}

/** 把浮窗现在的样子交出去记下。只在一次操作结束时调，不必每次移动都写。 */
function rememberState(): void {
  lastActions?.rememberState({ position, minimized });
}

function paint(): void {
  if (host === null || lastView === null || lastActions === null) {
    return;
  }

  releaseEditor();
  const element = minimized ? createChip(lastView) : createPanel(lastView, lastActions);
  host.replaceChildren(...withStyleSheet(element));
  rendered = element;
  place(element, minimized ? CHIP_SIZE : panelWidth);
  watchViewport();
}

/** 影子根里要先放一份样式表；面板与圆片都在它里面才吃得到伪元素那几条规则。 */
function withStyleSheet(element: HTMLElement): Node[] {
  if (!(host instanceof ShadowRoot)) {
    return [element];
  }

  const style = document.createElement('style');
  style.textContent = PANEL_STYLE;
  return [style, element];
}

/** 释放上一轮授权区留下的监听与定时器：面板每次重画都会造一个新的。 */
function releaseEditor(): void {
  if (editorHandler !== null) {
    window.removeEventListener('message', editorHandler);
    editorHandler = null;
  }
  if (editorTimer !== null) {
    window.clearTimeout(editorTimer);
    editorTimer = null;
  }
}

/**
 * 当这个浮窗没画过。
 *
 * 关闭按钮把浮窗从页面上拿掉，但渲染层手里那份"上一次的视图"还在——授权状态一变、
 * 或会话里的样子读回来，重画一次就又把它画了回来。关掉就该忘掉，
 * 下次要显示得由内容脚本重新调 renderPanel。
 */
function forgetRendered(): void {
  releaseEditor();
  viewportObserver?.disconnect();
  viewportObserver = null;
  host = null;
  lastView = null;
  lastActions = null;
  rendered = null;
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
    if (rendered === null || position === null) {
      return;
    }
    position = clampToViewport(position, rendered);
    rendered.style.left = `${position.left}px`;
    rendered.style.top = `${position.top}px`;
  });
  viewportObserver.observe(document.documentElement);
}

/** 这一次要不要在设置区下面挂上隐私声明。只有真的把文字发出去过的结局才挂。 */
function needsPrivacyNotice(view: PanelView): boolean {
  return (view.kind === 'result' || view.kind === 'failure') && view.privacyNotice;
}

function createPanel(view: PanelView, actions: PanelActions): HTMLElement {
  const panel = createContainer();
  const body = createBody();
  const header = createHeader(actions);
  enableDrag(panel, header);
  panel.append(header, body);
  if (autoOpenEditor) {
    panel.append(createAutoOpenEditor(actions));
  }
  if (needsPrivacyNotice(view)) {
    panel.append(createPrivacyNotice());
  }

  switch (view.kind) {
    case 'loading':
      body.append(createLine(LOADING_TEXTS[view.phase], 'opacity: 0.85'));
      break;

    case 'result':
      body.append(...createResult(view.analysis, view.readItems));
      if (view.expired) {
        body.append(
          createLine(EXPIRED_NOTE, 'font-size: 13px; opacity: 0.8'),
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

    // 同页里被分析的那批讨论整段换了（换排序、换筛选）：与换页一样不给旧分数
    case 'discussionReplaced':
      body.append(
        createLine(DISCUSSION_REPLACED_NOTE, ''),
        createButton(REANALYZE_LABEL, actions.reanalyze),
      );
      break;

    case 'failure':
      body.append(createLine(FAILURE_TEXTS[view.reason], ''));
      break;

    // 没读到内容。不写"还没加载出来"，也不写"这一页没有讨论区"：两者都在替用户下结论，
    // 而我们真正知道的只有"没读到"。要不要再试一次，用户比我们清楚——人就在那一页上
    case 'empty':
      body.append(
        createLine(view.retried ? '还是没读到可以分析的讨论内容。' : '没读到可以分析的讨论内容。', ''),
        createLine(
          view.retried
            ? '也可能要登录之后才看得到。你可以自己往下滚一点，再点一次。'
            : '如果这一页确实有评论，我可以滚过去再读一次。',
          'font-size: 13px; opacity: 0.8',
        ),
        createButton(view.retried ? '再试一下' : '好，试一下', actions.readDiscussion),
      );
      break;
  }

  panel.append(...createResizeHandles(panel));
  return panel;
}

/** 折叠成一枚圆片：顺手把分数摆在上面，收起也能看到读数。 */
function createChip(view: PanelView): HTMLElement {
  const score = view.kind === 'result' ? String(view.analysis.flameIntensity) : null;

  const chip = document.createElement('button');
  chip.textContent = score ?? '空气';
  chip.title = '展开读空气';
  // 圆片上的那个数字对读屏器来说没有来历，所以把动作和读数一起念出来
  chip.setAttribute('aria-label', score === null ? '展开读空气' : `展开读空气，当前 ${score}`);
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
    rememberState();
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
 * 手柄平时透明，指针压上去才显出一条边（样式在影子根的样式表里，见 PANEL_STYLE）——
 * 它们不该破坏浮窗的外观，但也得让人知道这里能拖。
 * 拖哪条边，对面的那条边就不动：拖左边时右边缘固定，拖上边时底边固定，这样才像在拉窗口。
 */
function createResizeHandles(panel: HTMLElement): HTMLElement[] {
  return RESIZE_HANDLES.map(({ edge, cursor, box }) => {
    const handle = document.createElement('div');
    handle.className = 'resize-edge';
    handle.style.cssText = [
      'position: absolute',
      box,
      `cursor: ${cursor}`,
      'touch-action: none',
    ].join(';');

    enableResize(panel, handle, edge);
    return handle;
  });
}

/**
 * 开始一次指针拖动。
 *
 * 只接左键，把指针锁在这个热区上，松手或取消时把监听摘干净。
 * 拖动浮窗与拖动缩放热区共用这一段：两者除了移动时算什么、以及结束时要不要记落点，其余一样。
 */
function beginPointerDrag(
  handle: HTMLElement,
  event: PointerEvent,
  onMove: (moveEvent: PointerEvent) => void,
  onEnd: () => void,
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
    onEnd();
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
    }, rememberState);
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
    }, rememberState);
  });
}

/**
 * 结论区：分数、摘要、依据，最后一行说明这份结论建立在多少条内容上。
 *
 * 条数垫底而不是摆在分数旁边：它是这份结论的底细，不是结论本身。说"其中"是因为
 * 一万字的窗口摊在整段上，读到的只是里面几条，不是开头连续几条；说"约"是因为
 * 窗口边界落在两条之间，最后一条可能只进去一半（见 extract 里的取样与计数）。
 * 认不出"一条内容"的站点不给这一行，而不是编一个通用的词凑上。
 */
function createResult(
  analysis: AtmosphereAnalysis,
  readItems: { count: number; noun: string } | null,
): HTMLElement[] {
  const lines: HTMLElement[] = [createScore(analysis), createLine(analysis.summary, '')];

  if (analysis.evidence.length > 0) {
    lines.push(createEvidence(analysis.evidence));
  }
  if (analysis.confidence < LOW_CONFIDENCE) {
    lines.push(createLine('这里的内容不太好判断', 'font-size: 13px; opacity: 0.8'));
  }
  if (readItems !== null && readItems.count > 0) {
    lines.push(
      createLine(
        `读了其中约 ${readItems.count} 条${readItems.noun}`,
        'font-size: 13px; opacity: 0.8',
      ),
    );
  }

  return lines;
}

/**
 * 一次性隐私声明：面板里的一块区域，压在设置区下面，与正文一样用一条线隔开。
 *
 * 它出现的那一次，正好是用户第一次看到"文字要出本机"，所以只在这里说，不占固定位置、
 * 也不做成设置项。做成一块区域、且带标题，是因为它是一条声明——混在结果里读着像结果的
 * 又一句。关掉只是收起这一块：说过没有在显示的时候就已经记下了。
 *
 * 措辞取 shared/privacy 里最短的那句：一次性提示的版面只够说清"文字发到服务器判断、
 * 服务器不留"，"什么时候发"和最后一环留给设置里的完整声明。
 */
function createPrivacyNotice(): HTMLElement {
  const region = document.createElement('div');
  // 与设置区同一套间距：线上面的 6px 是上一块自带的，线下面给 12px
  region.style.cssText = [
    'margin-top: 6px',
    'padding-top: 12px',
    'border-top: 1px solid rgba(255, 255, 255, 0.1)',
    'font-size: 13px',
  ].join(';');

  const head = document.createElement('div');
  head.style.cssText =
    'display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px';

  const title = document.createElement('span');
  title.textContent = PRIVACY_TEXT.title;
  title.style.fontWeight = '600';

  const close = createIconButton('close', '关闭隐私声明', () => {
    region.remove();
  });

  head.append(title, close);

  const sentence = document.createElement('div');
  sentence.textContent = PRIVACY_TEXT.brief;
  // 和其他正文一样自带 6px 下边距：面板底部那一圈留白因此处处一样
  sentence.style.cssText = 'opacity: 0.8; margin-bottom: 6px';

  region.append(head, sentence);
  return region;
}

/**
 * 分数：数字占主位，等级降成它旁边的次要标签。
 *
 * 之前两者挤在同一行、字号也只差两级，扫一眼分不出哪个才是结论。
 * 窄到放不下时让等级换行，而不是被裁掉。
 */
function createScore(analysis: AtmosphereAnalysis): HTMLElement {
  const line = document.createElement('div');
  line.style.cssText =
    'display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-bottom: 8px';

  const score = document.createElement('span');
  score.textContent = String(analysis.flameIntensity);
  score.style.cssText = 'font-size: 26px; font-weight: 600; line-height: 1.1';

  const level = document.createElement('span');
  level.textContent = LEVEL_LABELS[analysis.level];
  level.style.cssText = 'font-size: 13px; opacity: 0.85';

  line.append(score, level);
  return line;
}

/** 依据做成列表：三条以内的短句比一段话更容易扫过去。 */
function createEvidence(evidence: string[]): HTMLElement {
  const list = document.createElement('ul');
  list.style.cssText = 'margin: 0 0 6px; padding-left: 18px; font-size: 13px; opacity: 0.8';

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
    // 窗口被压到极小时，子元素不该溢出圆角边框；内容区自己会滚，不需要它来撑开
    'overflow: hidden',
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
  // 滚动条样式写在影子根的样式表里，见 PANEL_STYLE
  body.className = 'panel-body';
  body.style.cssText = 'flex: 1 1 auto; min-height: 0; overflow: auto';
  return body;
}

function createHeader(actions: PanelActions): HTMLElement {
  const header = document.createElement('div');
  header.style.cssText = [
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    // 标题栏下比别处多给一点：正文第一行是 26px 的数字，方块大、行高又紧，
    // 同样是 12px，大字看着就是更贴边
    'margin-bottom: 16px',
    // 不用 cursor: move，它会把指针换成十字箭头；这里保持普通箭头
    'cursor: default',
    'user-select: none',
    'touch-action: none',
  ].join(';');

  const title = document.createElement('span');
  title.textContent = '读空气';
  // 窗口被压得很细时先牺牲标题：它只是名字，几个按钮是真的要能点到
  title.style.cssText =
    'font-weight: 600; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis';

  const refresh = createIconButton('refresh', '重新分析', actions.reanalyze);
  // 图标兼作状态：本站已开启自动打开时染色，设置区展开时带一层底色
  const settings = createIconButton('settings', '本站设置', () => {
    autoOpenEditor = !autoOpenEditor;
    paint();
  });
  settings.style.background = autoOpenEditor ? 'rgba(255, 255, 255, 0.14)' : 'transparent';
  settings.style.borderRadius = '4px';
  if (autoOpen) {
    settings.style.color = ACTIVE_ICON_COLOR;
  }

  const minimize = createIconButton('minimize', '收起', () => {
    minimized = true;
    paint();
    rememberState();
  });
  const close = createIconButton('close', '关闭', () => {
    // 关闭后下次再点图标应当是展开的面板，所以顺带把折叠状态复位
    minimized = false;
    rememberState();
    forgetRendered();
    actions.close();
  });

  const controls = document.createElement('span');
  controls.style.cssText = 'display: flex; gap: 2px; flex: 0 0 auto';
  controls.append(refresh, settings, minimize, close);

  header.append(title, controls);
  return header;
}

/**
 * 设置区：把扩展自己的授权界面嵌进来。
 *
 * 为什么不自己画这块界面：请求 host 权限必须在用户手势里发起，而内容脚本没有
 * chrome.permissions 这个 API，只有扩展页面调得动。嵌入页面渲染完会把自身高度报过来，
 * 面板据此留出位置；报不回来就说明这一页不允许嵌扩展页面，退回到独立窗口。
 */
function createAutoOpenEditor(actions: PanelActions): HTMLElement {
  const area = document.createElement('div');
  // 与正文分开：一条细线加两侧留白。只靠拉开距离，在窄浮窗里很难看出这是另一块。
  // 线上面算上正文末行自带的 6px，两侧正好各 12px。
  // 下边距 6px 是为了它后面（隐私声明）或面板底边都保持同样的 12px 与 18px
  area.style.cssText = [
    'margin-top: 6px',
    'margin-bottom: 6px',
    'padding-top: 12px',
    'border-top: 1px solid rgba(255, 255, 255, 0.1)',
  ].join(';');

  if (editorFailed) {
    // 只说这份设置没加载出来：不猜原因，也不把责任推给站点——用户更信站点，那反而像我们被拒了
    area.append(
      createLine('设置区加载失败', 'font-size: 13px; opacity: 0.8'),
      createButton('在独立窗口里设置', actions.openAutoOpenPage),
    );
    return area;
  }

  const frame = document.createElement('iframe');
  frame.src = actions.autoOpenFrameUrl;
  frame.style.cssText = [
    'display: block',
    'width: 100%',
    `height: ${editorHeight ?? 0}px`,
    'border: none',
    // 面板自己有底色，嵌入页面透明才不会切出一块
    'background: transparent',
  ].join(';');

  // 高度由嵌入页面自报：面板算不出跨源文档的高度。
  // 只认这一个来源：来源对、窗口对、形状对，三样都满足才算数
  const expectedOrigin = new URL(frame.src).origin;
  const handler = (event: MessageEvent): void => {
    if (
      event.origin !== expectedOrigin ||
      event.source !== frame.contentWindow ||
      !isEditorHeight(event.data)
    ) {
      return;
    }
    editorHeight = event.data.height;
    editorFailed = false;
    if (editorTimer !== null) {
      window.clearTimeout(editorTimer);
      editorTimer = null;
    }
    frame.style.height = `${editorHeight}px`;
  };
  editorHandler = handler;
  window.addEventListener('message', handler);

  editorTimer = window.setTimeout(() => {
    editorTimer = null;
    editorFailed = true;
    paint();
  }, EDITOR_TIMEOUT_MS);

  area.append(frame);
  return area;
}

function isEditorHeight(value: unknown): value is { type: 'autoOpenHeight'; height: number } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { type?: unknown; height?: unknown };
  return candidate.type === 'autoOpenHeight' && typeof candidate.height === 'number';
}

/** 标题栏上的小按钮：不参与拖动，也不让事件冒泡到页面。 */
function createIconButton(
  kind: IconKind,
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
type IconKind = 'minimize' | 'close' | 'refresh' | 'settings';

const ICON_SHAPES: Record<IconKind, { lines?: number[][]; paths?: string[] }> = {
  minimize: { lines: [[3, 8, 13, 8]] },
  close: {
    lines: [
      [4, 4, 12, 12],
      [12, 4, 4, 12],
    ],
  },
  // 一段缺口圆弧加一个箭头，读作"再算一遍"：圆心 (8,8)、半径 5，从顶端顺时针走到左下
  refresh: { paths: ['M 8 3 A 5 5 0 1 1 3.3 9.7', 'M 5.9 1.7 L 8 3 L 5.9 4.3'] },
  // 两根滑杆：16px 下画齿轮会糊成一团，滑杆四条线段就画得准，也更像"一小块设置"
  settings: {
    lines: [
      [2, 5.5, 14, 5.5],
      [10, 3.5, 10, 7.5],
      [2, 10.5, 14, 10.5],
      [6, 8.5, 6, 12.5],
    ],
  },
};

function createIcon(kind: IconKind): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  for (const [x1, y1, x2, y2] of ICON_SHAPES[kind].lines ?? []) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    svg.append(line);
  }

  for (const definition of ICON_SHAPES[kind].paths ?? []) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', definition);
    svg.append(path);
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
    // 与文字行一样留一段下边距：否则以按钮结尾的视图里，正文与下面那块区域会少 6px
    'margin-bottom: 6px',
    'padding: 6px 10px',
    'border: none',
    'border-radius: 6px',
    'background: #3a67e0',
    'color: #fff',
    'font: inherit',
    'cursor: pointer',
  ].join(';');
  button.addEventListener('click', onClick);
  return button;
}

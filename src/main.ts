type Tool = 'select' | 'equipotential' | 'phreatic' | 'noflow-line' | 'noflow-zone' | 'standpipe';
type LineKind = 'equipotential' | 'phreatic' | 'noflow';
type CoordinateMode = 'real' | 'transformed';

interface Point {
  x: number;
  y: number;
}

interface LineBoundary {
  id: number;
  kind: LineKind;
  vertices: Point[];
  head: number;
}

interface NoFlowPolygon {
  id: number;
  vertices: Point[];
}

interface DomainSettings {
  width: number;
  height: number;
}

interface SolverSettings {
  nx: number;
  ny: number;
  kx: number;
  ky: number;
  maxIter: number;
  tolerance: number;
  omega: number;
}

interface ViewSettings {
  contours: number;
  streamlines: number;
  autoSolve: boolean;
  coordinateMode: CoordinateMode;
  showHeadMap: boolean;
}

interface ContourSegment {
  level: number;
  a: Point;
  b: Point;
}

interface Solution {
  heads: number[][];
  active: boolean[][];
  dirichlet: boolean[][];
  qx: number[][];
  qy: number[][];
  iterations: number;
  converged: boolean;
  residual: number;
  minHead: number;
  maxHead: number;
  contourLevels: number[];
  contourSegments: ContourSegment[];
  streamPaths: Point[][];
  anchoredNode: boolean;
}

interface StandpipeReading {
  point: Point;
  head: number;
  rise: number;
}

interface PresetLine {
  kind: LineKind;
  vertices: Point[];
  head?: number;
}

interface PresetPolygon {
  vertices: Point[];
}

interface ExamplePreset {
  id: string;
  label: string;
  summary: string;
  domain: DomainSettings;
  solver: SolverSettings;
  view: ViewSettings;
  newHead?: number;
  lines: PresetLine[];
  polygons?: PresetPolygon[];
  standpipePoint?: Point;
}

interface PersistedFlowNetStateV1 {
  schema: 'flownet2-state';
  version: 1;
  savedAt: string;
  domain: DomainSettings;
  solver: SolverSettings;
  view: ViewSettings;
  newHead: number;
  lineBoundaries: LineBoundary[];
  polygons: NoFlowPolygon[];
  standpipePoint: Point | null;
}

type Selected = { kind: 'line'; id: number } | { kind: 'polygon'; id: number } | null;

type DragState =
  | { type: 'none' }
  | { type: 'line-vertex'; id: number; vertexIndex: number }
  | { type: 'line-move'; id: number; startPointer: Point; startVertices: Point[] }
  | { type: 'pan'; startScreen: Point; startCenter: Point }
  | { type: 'polygon-move'; id: number; startPointer: Point; startVertices: Point[] }
  | { type: 'polygon-vertex'; id: number; vertexIndex: number }
  | { type: 'polygon-draw'; start: Point; current: Point }
  | { type: 'standpipe-move' };

interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ViewBounds {
  xMin: number;
  yMin: number;
  width: number;
  height: number;
}

interface CanvasView {
  viewport: Viewport;
  bounds: ViewBounds;
}

interface RenderStyleTokens {
  soilColor: string;
  flowLineColor: string;
  equipotentialColor: string;
  phreaticColor: string;
  noFlowColor: string;
  flowLineWidth: number;
  equipotentialWidth: number;
}

const marchingCases: Array<Array<[number, number]>> = [
  [],
  [[3, 0]],
  [[0, 1]],
  [[3, 1]],
  [[1, 2]],
  [
    [3, 2],
    [0, 1],
  ],
  [[0, 2]],
  [[3, 2]],
  [[2, 3]],
  [[0, 2]],
  [
    [1, 3],
    [0, 2],
  ],
  [[1, 2]],
  [[3, 1]],
  [[0, 1]],
  [[3, 0]],
  [],
];

const DEFAULT_EXAMPLE_ID = 'uniform-ep';

let examplePresets: ExamplePreset[] = [];

const canvas = byId<HTMLCanvasElement>('flowCanvas');
const ctx = getContext2D(canvas);
const canvasWrap = byId<HTMLElement>('canvasWrap');

const domainWidthInput = byId<HTMLInputElement>('domainWidth');
const domainHeightInput = byId<HTMLInputElement>('domainHeight');
const gridNxInput = byId<HTMLInputElement>('gridNx');
const gridNyInput = byId<HTMLInputElement>('gridNy');
const kxInput = byId<HTMLInputElement>('kx');
const kyInput = byId<HTMLInputElement>('ky');
const newHeadInput = byId<HTMLInputElement>('newHead');
const maxIterInput = byId<HTMLInputElement>('maxIter');
const toleranceInput = byId<HTMLInputElement>('tolerance');
const omegaInput = byId<HTMLInputElement>('omega');
const contoursInput = byId<HTMLInputElement>('contours');
const streamlinesInput = byId<HTMLInputElement>('streamlines');
const coordModeSelect = byId<HTMLSelectElement>('coordMode');
const showHeadMapInput = byId<HTMLInputElement>('showHeadMap');
const autoSolveInput = byId<HTMLInputElement>('autoSolve');
const statusText = byId<HTMLParagraphElement>('statusText');
const standpipeText = byId<HTMLParagraphElement>('standpipeText');
const selectionType = byId<HTMLParagraphElement>('selectionType');
const selectedHeadRow = byId<HTMLLabelElement>('selectedHeadRow');
const selectedHeadInput = byId<HTMLInputElement>('selectedHead');
const toolHint = byId<HTMLParagraphElement>('toolHint');
const toolStep = byId<HTMLParagraphElement>('toolStep');
const newHeadWrap = byId<HTMLLabelElement>('newHeadWrap');
const solveBtn = byId<HTMLButtonElement>('solveBtn');
const exportBtn = byId<HTMLButtonElement>('exportBtn');
const saveStateBtn = byId<HTMLButtonElement>('saveStateBtn');
const loadStateBtn = byId<HTMLButtonElement>('loadStateBtn');
const loadStateInput = byId<HTMLInputElement>('loadStateInput');
const deleteBtn = byId<HTMLButtonElement>('deleteBtn');
const toolRow = byId<HTMLDivElement>('toolRow');
const inventorySummary = byId<HTMLParagraphElement>('inventorySummary');
const inventoryList = byId<HTMLDivElement>('inventoryList');
const canvasPrompt = byId<HTMLParagraphElement>('canvasPrompt');
const zoomInBtn = byId<HTMLButtonElement>('zoomInBtn');
const zoomOutBtn = byId<HTMLButtonElement>('zoomOutBtn');
const fitViewBtn = byId<HTMLButtonElement>('fitViewBtn');
const panModeBtn = byId<HTMLButtonElement>('panModeBtn');
const zoomLabel = byId<HTMLSpanElement>('zoomLabel');
const cursorReadout = byId<HTMLSpanElement>('cursorReadout');
const exampleSelect = byId<HTMLSelectElement>('exampleSelect');
const exampleSummary = byId<HTMLParagraphElement>('exampleSummary');

const toolButtons = Array.from(toolRow.querySelectorAll<HTMLButtonElement>('button[data-tool]'));

const TOOL_SHORTCUT_INFO: Record<Tool, { label: string; aria: string }> = {
  select: { label: 'Space', aria: 'Space' },
  equipotential: { label: 'E', aria: 'E' },
  phreatic: { label: 'P', aria: 'P' },
  'noflow-line': { label: 'F', aria: 'F' },
  'noflow-zone': { label: 'I', aria: 'I' },
  standpipe: { label: 'S', aria: 'S' },
};

const state = {
  domain: {
    width: 30,
    height: 12,
  } as DomainSettings,
  solver: {
    nx: 81,
    ny: 41,
    kx: 1,
    ky: 1,
    maxIter: 4000,
    tolerance: 1e-4,
    omega: 1.6,
  } as SolverSettings,
  view: {
    contours: 14,
    streamlines: 12,
    autoSolve: true,
    coordinateMode: 'real',
    showHeadMap: false,
  } as ViewSettings,
  tool: 'select' as Tool,
  pendingLineStart: null as Point | null,
  previewPoint: null as Point | null,
  lineBoundaries: [] as LineBoundary[],
  polygons: [] as NoFlowPolygon[],
  selected: null as Selected,
  drag: { type: 'none' } as DragState,
  nextId: 1,
  standpipePoint: null as Point | null,
  standpipeReading: null as StandpipeReading | null,
  camera: {
    zoom: 1,
    center: { x: 15, y: 6 } as Point,
    panMode: false,
    minZoom: 1,
    maxZoom: 12,
  },
  coarsePointer: window.matchMedia('(pointer: coarse)').matches,
  lastPointerType: 'mouse',
  hoverPoint: null as Point | null,
  modifiers: {
    alt: false,
    ctrl: false,
    meta: false,
  },
  solution: null as Solution | null,
};

let solveTimer: number | null = null;
let fileDragDepth = 0;
const CURSOR_PLUS = buildModifierCursor('plus');
const CURSOR_MINUS = buildModifierCursor('minus');
const RENDER_STYLE = readRenderStyleTokens();

wireControls();
resizeCanvas();
updateCanvasCursor();
void initializeExamplesAndSolve();
window.addEventListener('resize', () => {
  resizeCanvas();
  render();
  updateCanvasCursor();
});

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Missing #${id}`);
  }
  return el as T;
}

function getContext2D(element: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = element.getContext('2d');
  if (!context) {
    throw new Error('Unable to create 2D canvas context');
  }
  return context;
}

function readRenderStyleTokens(): RenderStyleTokens {
  return {
    soilColor: readCssVar('--soil', '#8f6b43'),
    flowLineColor: readCssVar('--flow-line', '#0000ff'),
    equipotentialColor: readCssVar('--equipotential', '#ff0000'),
    phreaticColor: readCssVar('--phreatic', '#1d4ed8'),
    noFlowColor: readCssVar('--no-flow', '#ffffff'),
    flowLineWidth: readCssVarNumber('--flow-line-width', 2.4),
    equipotentialWidth: readCssVarNumber('--equipotential-width', 2.8),
  };
}

function readCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function readCssVarNumber(name: string, fallback: number): number {
  const value = readCssVar(name, '');
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function initializeExamplesAndSolve(): Promise<void> {
  try {
    examplePresets = await loadExamplePresets();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    statusText.textContent = `Failed to load example presets: ${message}`;
    render();
    return;
  }

  if (examplePresets.length === 0) {
    statusText.textContent = 'No example presets were loaded.';
    render();
    return;
  }

  initExamplePicker();
  const requested = getRequestedExampleFromUrl();
  const initialExampleId =
    requested && examplePresets.some((preset) => preset.id === requested) ? requested : DEFAULT_EXAMPLE_ID;
  const resolvedExampleId =
    examplePresets.some((preset) => preset.id === initialExampleId) ? initialExampleId : examplePresets[0].id;
  loadExampleById(resolvedExampleId, { updateUrl: false, solve: false });
  solveAndRender();
}

async function loadExamplePresets(): Promise<ExamplePreset[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}example-presets.json`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error('Presets file must contain an array.');
  }

  return data.map((presetRaw, index) => {
    if (!presetRaw || typeof presetRaw !== 'object') {
      throw new Error(`Preset #${index + 1} is not an object.`);
    }
    const preset = presetRaw as ExamplePreset;
    if (!preset.id || !preset.label || !preset.summary) {
      throw new Error(`Preset #${index + 1} is missing id/label/summary.`);
    }
    if (!Array.isArray(preset.lines) || !preset.domain || !preset.solver || !preset.view) {
      throw new Error(`Preset "${preset.id}" is missing required sections.`);
    }
    preset.lines.forEach((line, lineIndex) => {
      if (!Array.isArray(line.vertices) || line.vertices.length < 2) {
        throw new Error(`Preset "${preset.id}" line #${lineIndex + 1} needs at least 2 vertices.`);
      }
    });
    return {
      ...preset,
      view: {
        ...preset.view,
        showHeadMap: Boolean(preset.view.showHeadMap),
      },
    };
  });
}

function initExamplePicker(): void {
  exampleSelect.innerHTML = '';
  examplePresets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label;
    exampleSelect.appendChild(option);
  });

  exampleSelect.addEventListener('change', () => {
    loadExampleById(exampleSelect.value);
  });

  updateExampleSummary();
}

function getRequestedExampleFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('example');
  if (!requested) {
    return null;
  }
  return examplePresets.some((preset) => preset.id === requested) ? requested : null;
}

function loadExampleById(
  presetId: string,
  options?: { updateUrl?: boolean; solve?: boolean },
): void {
  const preset = examplePresets.find((item) => item.id === presetId);
  if (!preset) {
    return;
  }

  state.domain.width = preset.domain.width;
  state.domain.height = preset.domain.height;
  state.solver = { ...preset.solver };
  state.view = { ...preset.view };

  if (typeof preset.newHead === 'number') {
    newHeadInput.value = String(preset.newHead);
  }

  state.pendingLineStart = null;
  state.previewPoint = null;
  state.selected = null;
  state.drag = { type: 'none' };
  state.standpipePoint = preset.standpipePoint ? { ...preset.standpipePoint } : null;
  state.standpipeReading = null;
  state.solution = null;
  state.camera.zoom = 1;
  state.camera.center = { x: 0.5 * state.domain.width, y: 0.5 * state.domain.height };
  state.camera.panMode = false;
  state.lineBoundaries = [];
  state.polygons = [];
  state.nextId = 1;

  preset.lines.forEach((line) => {
    const lineHead = line.head ?? 0;
    addBoundaryFromVertices(line.kind, line.vertices, lineHead);
  });

  (preset.polygons ?? []).forEach((polygon) => {
    state.polygons.push({
      id: state.nextId++,
      vertices: polygon.vertices.map((vertex) => clampPoint(vertex)),
    });
  });

  domainWidthInput.value = String(state.domain.width);
  domainHeightInput.value = String(state.domain.height);
  gridNxInput.value = String(state.solver.nx);
  gridNyInput.value = String(state.solver.ny);
  kxInput.value = String(state.solver.kx);
  kyInput.value = String(state.solver.ky);
  maxIterInput.value = String(state.solver.maxIter);
  toleranceInput.value = String(state.solver.tolerance);
  omegaInput.value = String(state.solver.omega);
  contoursInput.value = String(state.view.contours);
  streamlinesInput.value = String(state.view.streamlines);
  coordModeSelect.value = state.view.coordinateMode;
  showHeadMapInput.checked = state.view.showHeadMap;
  autoSolveInput.checked = state.view.autoSolve;
  exampleSelect.value = preset.id;

  setTool('select');
  updateSelectionPanel();
  updateExampleSummary();

  if (options?.updateUrl !== false) {
    setExampleInUrl(preset.id);
  }

  if (options?.solve !== false) {
    solveAndRender();
  }
}

function setExampleInUrl(presetId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('example', presetId);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function updateExampleSummary(): void {
  const preset = examplePresets.find((item) => item.id === exampleSelect.value);
  if (!preset) {
    exampleSummary.textContent = '';
    return;
  }
  exampleSummary.textContent = preset.summary;
}

function wireControls(): void {
  const numericInputs = [
    domainWidthInput,
    domainHeightInput,
    gridNxInput,
    gridNyInput,
    kxInput,
    kyInput,
    maxIterInput,
    toleranceInput,
    omegaInput,
    contoursInput,
    streamlinesInput,
  ];

  numericInputs.forEach((input) => {
    input.addEventListener('change', () => {
      readInputsIntoState();
      scheduleSolve();
    });
  });

  autoSolveInput.addEventListener('change', () => {
    state.view.autoSolve = autoSolveInput.checked;
    if (state.view.autoSolve) {
      scheduleSolve(1);
    } else {
      render();
    }
  });

  coordModeSelect.addEventListener('change', () => {
    state.view.coordinateMode = coordModeSelect.value === 'transformed' ? 'transformed' : 'real';
    updateGuidanceUI();
    render();
  });

  showHeadMapInput.addEventListener('change', () => {
    state.view.showHeadMap = showHeadMapInput.checked;
    render();
  });

  selectedHeadInput.addEventListener('change', () => {
    if (state.selected?.kind !== 'line') {
      return;
    }
    const line = state.lineBoundaries.find((item) => item.id === state.selected?.id);
    if (!line || line.kind !== 'equipotential') {
      return;
    }
    line.head = readNumber(selectedHeadInput, line.head, -200, 200);
    updateBoundaryInventory();
    scheduleSolve();
  });

  toolButtons.forEach((button) => {
    const tool = button.dataset.tool as Tool | undefined;
    if (tool) {
      const shortcut = TOOL_SHORTCUT_INFO[tool];
      button.title = `${button.textContent?.trim() ?? tool} (${shortcut.label})`;
      button.setAttribute('aria-keyshortcuts', shortcut.aria);
    }
    button.addEventListener('click', () => {
      const toolValue = button.dataset.tool;
      if (!toolValue) {
        return;
      }
      setTool(toolValue as Tool);
    });
  });

  solveBtn.addEventListener('click', () => {
    solveAndRender();
  });

  exportBtn.addEventListener('click', () => {
    exportCanvasPng();
  });

  saveStateBtn.addEventListener('click', () => {
    exportStateJson();
  });

  loadStateBtn.addEventListener('click', () => {
    loadStateInput.click();
  });

  loadStateInput.addEventListener('change', async () => {
    const file = loadStateInput.files?.[0];
    loadStateInput.value = '';
    if (!file) {
      return;
    }
    await importStateFromFile(file);
  });

  deleteBtn.addEventListener('click', () => {
    deleteSelected();
  });

  zoomInBtn.addEventListener('click', () => {
    setZoom(state.camera.zoom * 1.25);
  });

  zoomOutBtn.addEventListener('click', () => {
    setZoom(state.camera.zoom / 1.25);
  });

  fitViewBtn.addEventListener('click', () => {
    state.camera.zoom = 1;
    state.camera.center = { x: 0.5 * state.domain.width, y: 0.5 * state.domain.height };
    state.camera.panMode = false;
    updateGuidanceUI();
    render();
    updateCanvasCursor();
  });

  panModeBtn.addEventListener('click', () => {
    state.camera.panMode = !state.camera.panMode;
    if (state.camera.panMode) {
      state.pendingLineStart = null;
      state.previewPoint = null;
      state.drag = { type: 'none' };
    }
    updateGuidanceUI();
    render();
    updateCanvasCursor();
  });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('dragenter', onWindowDragEnter);
  window.addEventListener('dragover', onWindowDragOver);
  window.addEventListener('dragleave', onWindowDragLeave);
  window.addEventListener('drop', onWindowDrop);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

function readInputsIntoState(): void {
  const oldWidth = state.domain.width;
  const oldHeight = state.domain.height;

  state.domain.width = readNumber(domainWidthInput, state.domain.width, 5, 120);
  state.domain.height = readNumber(domainHeightInput, state.domain.height, 3, 60);
  state.solver.nx = toOddInteger(readNumber(gridNxInput, state.solver.nx, 11, 201));
  state.solver.ny = toOddInteger(readNumber(gridNyInput, state.solver.ny, 11, 201));
  state.solver.kx = readNumber(kxInput, state.solver.kx, 0.01, 1000);
  state.solver.ky = readNumber(kyInput, state.solver.ky, 0.01, 1000);
  state.solver.maxIter = Math.round(readNumber(maxIterInput, state.solver.maxIter, 200, 50000));
  state.solver.tolerance = readNumber(toleranceInput, state.solver.tolerance, 1e-7, 0.1);
  state.solver.omega = readNumber(omegaInput, state.solver.omega, 1, 1.95);
  state.view.contours = Math.round(readNumber(contoursInput, state.view.contours, 3, 30));
  state.view.streamlines = Math.round(readNumber(streamlinesInput, state.view.streamlines, 4, 36));

  if (state.domain.width !== oldWidth || state.domain.height !== oldHeight) {
    const widthScale = state.domain.width / oldWidth;
    const heightScale = state.domain.height / oldHeight;

    state.lineBoundaries.forEach((line) => {
      const scaledVertices = getLineVertices(line).map((vertex) => ({
        x: vertex.x * widthScale,
        y: vertex.y * heightScale,
      }));
      setLineVertices(line, scaledVertices);
    });

    state.polygons.forEach((polygon) => {
      polygon.vertices = polygon.vertices.map((vertex) =>
        clampPoint({
          x: vertex.x * widthScale,
          y: vertex.y * heightScale,
        }),
      );
    });

    if (state.standpipePoint) {
      state.standpipePoint.x *= widthScale;
      state.standpipePoint.y *= heightScale;
      state.standpipePoint = clampPoint(state.standpipePoint);
    }

    state.camera.center = clampCameraCenter({
      x: state.camera.center.x * widthScale,
      y: state.camera.center.y * heightScale,
    });
  }

  domainWidthInput.value = String(state.domain.width);
  domainHeightInput.value = String(state.domain.height);
  gridNxInput.value = String(state.solver.nx);
  gridNyInput.value = String(state.solver.ny);
  kxInput.value = String(state.solver.kx);
  kyInput.value = String(state.solver.ky);
  maxIterInput.value = String(state.solver.maxIter);
  toleranceInput.value = String(state.solver.tolerance);
  omegaInput.value = String(state.solver.omega);
  contoursInput.value = String(state.view.contours);
  streamlinesInput.value = String(state.view.streamlines);
}

function onWheel(event: WheelEvent): void {
  const view = getCanvasView();
  const screenPoint = eventToCanvasPoint(event);
  if (!pointInViewport(screenPoint, view.viewport)) {
    return;
  }
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
  setZoom(state.camera.zoom * factor, screenToWorld(screenPoint, view));
}

function setZoom(nextZoom: number, focusWorld?: Point): void {
  const clampedZoom = clamp(nextZoom, state.camera.minZoom, state.camera.maxZoom);
  if (Math.abs(clampedZoom - state.camera.zoom) < 1e-6) {
    return;
  }

  if (!focusWorld) {
    state.camera.zoom = clampedZoom;
    state.camera.center = clampCameraCenter(state.camera.center, clampedZoom);
    updateGuidanceUI();
    render();
    return;
  }

  const view = getCanvasView();
  const fracX = clamp((focusWorld.x - view.bounds.xMin) / view.bounds.width, 0, 1);
  const fracY = clamp((focusWorld.y - view.bounds.yMin) / view.bounds.height, 0, 1);
  const nextBounds = getViewBounds(clampedZoom, state.camera.center);
  const nextMinX = focusWorld.x - fracX * nextBounds.width;
  const nextMinY = focusWorld.y - fracY * nextBounds.height;

  const nextCenter = {
    x: nextMinX + 0.5 * nextBounds.width,
    y: nextMinY + 0.5 * nextBounds.height,
  };

  state.camera.zoom = clampedZoom;
  state.camera.center = clampCameraCenter(nextCenter, clampedZoom);
  updateGuidanceUI();
  render();
}

function clampCameraCenter(center: Point, zoom = state.camera.zoom): Point {
  const width = state.domain.width / zoom;
  const height = state.domain.height / zoom;
  const halfW = 0.5 * width;
  const halfH = 0.5 * height;
  return {
    x: clamp(center.x, halfW, state.domain.width - halfW),
    y: clamp(center.y, halfH, state.domain.height - halfH),
  };
}

function onKeyDown(event: KeyboardEvent): void {
  syncModifierState(event);
  updateCanvasCursor();

  if (event.key === 'Escape') {
    const hadPendingDraw =
      state.pendingLineStart !== null ||
      state.drag.type === 'polygon-draw' ||
      state.drag.type === 'pan' ||
      state.camera.panMode;
    if (!hadPendingDraw) {
      return;
    }
    state.pendingLineStart = null;
    state.previewPoint = null;
    state.drag = { type: 'none' };
    state.camera.panMode = false;
    updateGuidanceUI();
    render();
    updateCanvasCursor();
    return;
  }

  if ((event.key === 'Delete' || event.key === 'Backspace') && !isTypingTarget(event.target)) {
    event.preventDefault();
    deleteSelected();
    return;
  }

  if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  const shortcutTool = toolFromShortcut(event);
  if (shortcutTool) {
    event.preventDefault();
    setTool(shortcutTool);
  }
}

function toolFromShortcut(event: KeyboardEvent): Tool | null {
  if (event.code === 'Space' || event.key === ' ') {
    return 'select';
  }

  const key = event.key.toLowerCase();
  if (key === 'e') {
    return 'equipotential';
  }
  if (key === 'f') {
    return 'noflow-line';
  }
  if (key === 'p') {
    return 'phreatic';
  }
  if (key === 'i') {
    return 'noflow-zone';
  }
  if (key === 's') {
    return 'standpipe';
  }
  return null;
}

function onKeyUp(event: KeyboardEvent): void {
  syncModifierState(event);
  updateCanvasCursor();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

function deleteSelected(): void {
  if (!state.selected) {
    return;
  }
  if (state.selected.kind === 'line') {
    state.lineBoundaries = state.lineBoundaries.filter((line) => line.id !== state.selected?.id);
  } else {
    state.polygons = state.polygons.filter((polygon) => polygon.id !== state.selected?.id);
  }
  state.selected = null;
  updateSelectionPanel();
  scheduleSolve();
  updateCanvasCursor();
}

function readNumber(input: HTMLInputElement, fallback: number, min: number, max: number): number {
  const parsed = Number(input.value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return clamp(parsed, min, max);
}

function toOddInteger(value: number): number {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded + 1 : rounded;
}

function setTool(tool: Tool): void {
  state.tool = tool;
  state.camera.panMode = false;
  state.pendingLineStart = null;
  state.previewPoint = null;
  state.drag = { type: 'none' };
  toolButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tool === tool);
  });
  updateGuidanceUI();
  render();
  updateCanvasCursor();
}

function addBoundaryFromVertices(kind: LineKind, vertices: Point[], head: number): void {
  const normalizedVertices = normalizeLineVertices(vertices.map((vertex) => clampPoint(vertex)));
  if (normalizedVertices.length < 2) {
    return;
  }
  state.lineBoundaries.push({
    id: state.nextId,
    kind,
    vertices: normalizedVertices,
    head,
  });
  state.nextId += 1;
}

function getLineVertices(line: LineBoundary): Point[] {
  return line.vertices;
}

function setLineVertices(line: LineBoundary, vertices: Point[]): void {
  const normalizedVertices = normalizeLineVertices(vertices.map((vertex) => clampPoint(vertex)));
  if (normalizedVertices.length < 2) {
    return;
  }
  line.vertices = normalizedVertices;
}

function normalizeLineVertices(vertices: Point[]): Point[] {
  const result: Point[] = [];
  vertices.forEach((vertex) => {
    if (result.length === 0 || distance(result[result.length - 1], vertex) > 1e-9) {
      result.push({ ...vertex });
    }
  });
  return result;
}

function onPointerDown(event: PointerEvent): void {
  syncModifierState(event);
  const view = getCanvasView();
  const screenPoint = eventToCanvasPoint(event);
  if (!pointInViewport(screenPoint, view.viewport)) {
    state.hoverPoint = null;
    updateCanvasCursor();
    return;
  }
  const point = clampPoint(screenToWorld(screenPoint, view));
  state.hoverPoint = point;
  state.lastPointerType = event.pointerType || 'mouse';

  canvas.setPointerCapture(event.pointerId);

  if (state.camera.panMode) {
    state.drag = {
      type: 'pan',
      startScreen: screenPoint,
      startCenter: { ...state.camera.center },
    };
    updateGuidanceUI();
    render();
    updateCanvasCursor(point);
    return;
  }

  if (state.tool === 'select') {
    startSelectionDrag(point, event);
    render();
    updateCanvasCursor(point);
    return;
  }

  if (state.tool === 'standpipe') {
    state.standpipePoint = point;
    state.drag = { type: 'standpipe-move' };
    updateStandpipeReading();
    updateGuidanceUI();
    render();
    updateCanvasCursor(point);
    return;
  }

  if (state.tool === 'noflow-zone') {
    state.drag = { type: 'polygon-draw', start: point, current: point };
    updateGuidanceUI();
    render();
    updateCanvasCursor(point);
    return;
  }

  if (state.tool === 'equipotential' || state.tool === 'phreatic' || state.tool === 'noflow-line') {
    if (!state.pendingLineStart) {
      state.pendingLineStart = point;
      state.previewPoint = point;
      updateGuidanceUI();
      render();
      updateCanvasCursor(point);
      return;
    }

    const start = state.pendingLineStart;
    const end = clampPoint(point);
    state.pendingLineStart = null;
    state.previewPoint = null;
    updateGuidanceUI();

    if (distance(start, end) < 0.02 * Math.min(state.domain.width, state.domain.height)) {
      render();
      updateCanvasCursor(point);
      return;
    }

    const kindMap: Record<Tool, LineKind | null> = {
      select: null,
      standpipe: null,
      equipotential: 'equipotential',
      phreatic: 'phreatic',
      'noflow-line': 'noflow',
      'noflow-zone': null,
    };

    const mapped = kindMap[state.tool];
    if (!mapped) {
      render();
      updateCanvasCursor(point);
      return;
    }

    const lineHead = mapped === 'equipotential' ? readNumber(newHeadInput, 8, -200, 200) : 0;
    addBoundaryFromVertices(mapped, [start, end], lineHead);
    state.selected = { kind: 'line', id: state.nextId - 1 };
    updateSelectionPanel();
    scheduleSolve();
    updateCanvasCursor(point);
    return;
  }
}

function onPointerMove(event: PointerEvent): void {
  syncModifierState(event);
  const view = getCanvasView();
  const screenPoint = eventToCanvasPoint(event);
  state.lastPointerType = event.pointerType || state.lastPointerType;

  if (state.drag.type === 'pan') {
    const dxPx = screenPoint.x - state.drag.startScreen.x;
    const dyPx = screenPoint.y - state.drag.startScreen.y;
    const worldPerPxX = view.bounds.width / view.viewport.width;
    const worldPerPxY = view.bounds.height / view.viewport.height;
    state.camera.center = clampCameraCenter({
      x: state.drag.startCenter.x - dxPx * worldPerPxX,
      y: state.drag.startCenter.y + dyPx * worldPerPxY,
    });
    state.hoverPoint = clampPoint(screenToWorld(screenPoint, view));
    updateGuidanceUI();
    render();
    updateCanvasCursor(state.hoverPoint);
    return;
  }

  if (state.drag.type === 'standpipe-move') {
    const draggedPoint = clampPoint(screenToWorld(screenPoint, view));
    state.hoverPoint = draggedPoint;
    state.standpipePoint = draggedPoint;
    updateStandpipeReading();
    render();
    updateCanvasCursor(draggedPoint);
    return;
  }

  if (!pointInViewport(screenPoint, view.viewport)) {
    state.hoverPoint = null;
    updateCanvasCursor();
    return;
  }
  const point = clampPoint(screenToWorld(screenPoint, view));
  state.hoverPoint = point;
  state.lastPointerType = event.pointerType || state.lastPointerType;
  updateCanvasCursor(point);

  if (state.pendingLineStart) {
    state.previewPoint = point;
  }

  if (state.drag.type === 'line-vertex') {
    const drag = state.drag;
    const line = state.lineBoundaries.find((item) => item.id === drag.id);
    if (!line) {
      return;
    }
    const vertices = getLineVertices(line).map((vertex) => ({ ...vertex }));
    if (drag.vertexIndex < 0 || drag.vertexIndex >= vertices.length) {
      return;
    }
    vertices[drag.vertexIndex] = clampPoint(point);
    setLineVertices(line, vertices);
    scheduleSolve();
    render();
    updateCanvasCursor(point);
    return;
  }

  if (state.drag.type === 'line-move') {
    const drag = state.drag;
    const line = state.lineBoundaries.find((item) => item.id === drag.id);
    if (!line) {
      return;
    }
    const dxRaw = point.x - drag.startPointer.x;
    const dyRaw = point.y - drag.startPointer.y;

    const startBounds = polygonBoundsFromVertices(drag.startVertices);
    const minX = startBounds.minX;
    const maxX = startBounds.maxX;
    const minY = startBounds.minY;
    const maxY = startBounds.maxY;

    const dx = clamp(dxRaw, -minX, state.domain.width - maxX);
    const dy = clamp(dyRaw, -minY, state.domain.height - maxY);

    const movedVertices = drag.startVertices.map((vertex) => ({
      x: vertex.x + dx,
      y: vertex.y + dy,
    }));
    setLineVertices(line, movedVertices);
    scheduleSolve();
    render();
    updateCanvasCursor(point);
    return;
  }

  if (state.drag.type === 'polygon-move') {
    const drag = state.drag;
    const polygon = state.polygons.find((item) => item.id === drag.id);
    if (!polygon) {
      return;
    }
    const dxRaw = point.x - drag.startPointer.x;
    const dyRaw = point.y - drag.startPointer.y;

    const startBounds = polygonBoundsFromVertices(drag.startVertices);
    const dx = clamp(dxRaw, -startBounds.minX, state.domain.width - startBounds.maxX);
    const dy = clamp(dyRaw, -startBounds.minY, state.domain.height - startBounds.maxY);

    polygon.vertices = drag.startVertices.map((vertex) => ({
      x: vertex.x + dx,
      y: vertex.y + dy,
    }));
    scheduleSolve();
    render();
    updateCanvasCursor(point);
    return;
  }

  if (state.drag.type === 'polygon-vertex') {
    const drag = state.drag;
    const polygon = state.polygons.find((item) => item.id === drag.id);
    if (!polygon || drag.vertexIndex < 0 || drag.vertexIndex >= polygon.vertices.length) {
      return;
    }
    polygon.vertices[drag.vertexIndex] = clampPoint(point);
    scheduleSolve();
    render();
    updateCanvasCursor(point);
    return;
  }

  if (state.drag.type === 'polygon-draw') {
    state.drag.current = point;
    render();
    updateCanvasCursor(point);
    return;
  }

  render();
  updateCanvasCursor(point);
}

function onPointerUp(event: PointerEvent): void {
  syncModifierState(event);
  const view = getCanvasView();
  const screenPoint = eventToCanvasPoint(event);
  const point = pointInViewport(screenPoint, view.viewport)
    ? clampPoint(screenToWorld(screenPoint, view))
    : null;
  state.hoverPoint = point;

  if (point && state.drag.type === 'polygon-draw') {
    const polygon = createPolygonFromDrag(state.drag.start, state.drag.current);
    if (polygon) {
      state.polygons.push(polygon);
      state.selected = { kind: 'polygon', id: polygon.id };
      updateSelectionPanel();
      scheduleSolve();
    }
  }
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  state.drag = { type: 'none' };
  updateGuidanceUI();
  render();
  updateCanvasCursor(point);
}

function onPointerLeave(): void {
  if (state.drag.type === 'polygon-draw' || state.drag.type === 'standpipe-move') {
    return;
  }
  state.hoverPoint = null;
  state.previewPoint = null;
  render();
  updateCanvasCursor();
}

function onWindowDragEnter(event: DragEvent): void {
  if (!dragEventHasFiles(event)) {
    return;
  }
  event.preventDefault();
  fileDragDepth += 1;
  canvasWrap.classList.add('is-file-drag');
}

function onWindowDragOver(event: DragEvent): void {
  if (!dragEventHasFiles(event)) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
  canvasWrap.classList.add('is-file-drag');
}

function onWindowDragLeave(event: DragEvent): void {
  if (!dragEventHasFiles(event)) {
    return;
  }
  event.preventDefault();
  fileDragDepth = Math.max(0, fileDragDepth - 1);
  if (fileDragDepth === 0) {
    canvasWrap.classList.remove('is-file-drag');
  }
}

async function onWindowDrop(event: DragEvent): Promise<void> {
  if (!dragEventHasFiles(event)) {
    return;
  }
  event.preventDefault();
  fileDragDepth = 0;
  canvasWrap.classList.remove('is-file-drag');
  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return;
  }
  await importStateFromFile(file);
}

function dragEventHasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) {
    return false;
  }
  return Array.from(types).includes('Files');
}

function createPolygonFromDrag(start: Point, end: Point): NoFlowPolygon | null {
  const vertices = rectangleVerticesFromDrag(start, end);
  if (!vertices) {
    return null;
  }
  return {
    id: state.nextId++,
    vertices,
  };
}

function rectangleVerticesFromDrag(start: Point, end: Point): Point[] | null {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  const minSide = 0.01 * Math.min(state.domain.width, state.domain.height);
  if (width < minSide || height < minSide) {
    return null;
  }
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function startSelectionDrag(point: Point, event: PointerEvent): void {
  const hasModifier = event.altKey || event.ctrlKey || event.metaKey;

  if (hasModifier && state.selected) {
    if (state.selected.kind === 'line') {
      const selectedLine = state.lineBoundaries.find((line) => line.id === state.selected?.id);
      if (!selectedLine) {
        return;
      }
      if (event.altKey) {
        const edgeHit = findLineEdge(point, selectedLine.id);
        if (!edgeHit) {
          return;
        }
        const vertices = getLineVertices(selectedLine).map((vertex) => ({ ...vertex }));
        const insertIndex = edgeHit.edgeIndex + 1;
        vertices.splice(insertIndex, 0, edgeHit.projection);
        setLineVertices(selectedLine, vertices);
        state.drag = { type: 'line-vertex', id: selectedLine.id, vertexIndex: insertIndex };
        updateSelectionPanel();
        scheduleSolve();
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        const vertexHit = findLineVertex(point, selectedLine.id);
        const vertices = getLineVertices(selectedLine);
        if (!vertexHit || vertices.length <= 2) {
          return;
        }
        const next = vertices.map((vertex) => ({ ...vertex }));
        next.splice(vertexHit.vertexIndex, 1);
        setLineVertices(selectedLine, next);
        updateSelectionPanel();
        scheduleSolve();
        render();
        return;
      }
      return;
    }

    const selectedPolygon = state.polygons.find((polygon) => polygon.id === state.selected?.id);
    if (!selectedPolygon) {
      return;
    }
    if (event.altKey) {
      const edgeHit = findPolygonEdge(point, selectedPolygon.id);
      if (!edgeHit) {
        return;
      }
      const insertIndex = edgeHit.edgeIndex + 1;
      selectedPolygon.vertices.splice(insertIndex, 0, edgeHit.projection);
      state.drag = { type: 'polygon-vertex', id: selectedPolygon.id, vertexIndex: insertIndex };
      updateSelectionPanel();
      scheduleSolve();
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      const vertexHit = findPolygonVertex(point, selectedPolygon.id);
      if (!vertexHit || selectedPolygon.vertices.length <= 3) {
        return;
      }
      selectedPolygon.vertices.splice(vertexHit.vertexIndex, 1);
      updateSelectionPanel();
      scheduleSolve();
      render();
      return;
    }
    return;
  }

  const lineVertexHit = findLineVertex(point);
  if (lineVertexHit) {
    state.selected = { kind: 'line', id: lineVertexHit.id };
    state.drag = { type: 'line-vertex', id: lineVertexHit.id, vertexIndex: lineVertexHit.vertexIndex };
    updateSelectionPanel();
    return;
  }

  const vertexHit = findPolygonVertex(point);
  if (vertexHit) {
    state.selected = { kind: 'polygon', id: vertexHit.id };
    state.drag = { type: 'polygon-vertex', id: vertexHit.id, vertexIndex: vertexHit.vertexIndex };
    updateSelectionPanel();
    return;
  }

  const polygonHit = findPolygon(point);
  if (polygonHit) {
    state.selected = { kind: 'polygon', id: polygonHit.id };
    state.drag = {
      type: 'polygon-move',
      id: polygonHit.id,
      startPointer: point,
      startVertices: polygonHit.vertices.map((vertex) => ({ ...vertex })),
    };
    updateSelectionPanel();
    return;
  }

  const lineHit = findLine(point);
  if (lineHit) {
    state.selected = { kind: 'line', id: lineHit.id };
    state.drag = {
      type: 'line-move',
      id: lineHit.id,
      startPointer: point,
      startVertices: getLineVertices(lineHit).map((vertex) => ({ ...vertex })),
    };
    updateSelectionPanel();
    return;
  }

  state.selected = null;
  state.drag = { type: 'none' };
  updateSelectionPanel();
}

function findLineVertex(point: Point, lineId?: number): { id: number; vertexIndex: number } | null {
  const threshold = 1.1 * pointerWorldThreshold();
  for (let lineIndex = state.lineBoundaries.length - 1; lineIndex >= 0; lineIndex -= 1) {
    const line = state.lineBoundaries[lineIndex];
    if (typeof lineId === 'number' && line.id !== lineId) {
      continue;
    }
    const vertices = getLineVertices(line);
    for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex += 1) {
      if (distance(point, vertices[vertexIndex]) <= threshold) {
        return { id: line.id, vertexIndex };
      }
    }
  }
  return null;
}

function findLineEdge(point: Point, lineId?: number): { id: number; edgeIndex: number; projection: Point } | null {
  const threshold = 1.1 * pointerWorldThreshold();
  for (let lineIndex = state.lineBoundaries.length - 1; lineIndex >= 0; lineIndex -= 1) {
    const line = state.lineBoundaries[lineIndex];
    if (typeof lineId === 'number' && line.id !== lineId) {
      continue;
    }
    const vertices = getLineVertices(line);
    if (vertices.length < 2) {
      continue;
    }

    let bestDist = Number.POSITIVE_INFINITY;
    let bestIndex = -1;
    let bestProjection: Point | null = null;
    for (let i = 0; i < vertices.length - 1; i += 1) {
      const a = vertices[i];
      const b = vertices[i + 1];
      const projection = projectPointToSegment(point, a, b);
      const dist = distance(point, projection);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
        bestProjection = projection;
      }
    }

    if (bestProjection && bestDist <= threshold) {
      return {
        id: line.id,
        edgeIndex: bestIndex,
        projection: clampPoint(bestProjection),
      };
    }
  }
  return null;
}

function findPolygonVertex(point: Point, polygonId?: number): { id: number; vertexIndex: number } | null {
  const threshold = 1.1 * pointerWorldThreshold();
  for (let polygonIndex = state.polygons.length - 1; polygonIndex >= 0; polygonIndex -= 1) {
    const polygon = state.polygons[polygonIndex];
    if (typeof polygonId === 'number' && polygon.id !== polygonId) {
      continue;
    }
    for (let vertexIndex = 0; vertexIndex < polygon.vertices.length; vertexIndex += 1) {
      if (distance(point, polygon.vertices[vertexIndex]) <= threshold) {
        return { id: polygon.id, vertexIndex };
      }
    }
  }
  return null;
}

function findPolygonEdge(point: Point, polygonId?: number): { id: number; edgeIndex: number; projection: Point } | null {
  const threshold = 1.1 * pointerWorldThreshold();
  for (let polygonIndex = state.polygons.length - 1; polygonIndex >= 0; polygonIndex -= 1) {
    const polygon = state.polygons[polygonIndex];
    if (typeof polygonId === 'number' && polygon.id !== polygonId) {
      continue;
    }
    if (polygon.vertices.length < 2) {
      continue;
    }
    let bestDist = Number.POSITIVE_INFINITY;
    let bestIndex = -1;
    let bestProjection: Point | null = null;

    for (let i = 0; i < polygon.vertices.length; i += 1) {
      const a = polygon.vertices[i];
      const b = polygon.vertices[(i + 1) % polygon.vertices.length];
      const projection = projectPointToSegment(point, a, b);
      const dist = distance(point, projection);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
        bestProjection = projection;
      }
    }

    if (bestProjection && bestDist <= threshold) {
      return {
        id: polygon.id,
        edgeIndex: bestIndex,
        projection: clampPoint(bestProjection),
      };
    }
  }
  return null;
}

function findPolygon(point: Point): NoFlowPolygon | null {
  for (let index = state.polygons.length - 1; index >= 0; index -= 1) {
    const polygon = state.polygons[index];
    if (pointInPolygon(point, polygon.vertices)) {
      return polygon;
    }
  }
  return null;
}

function findLine(point: Point): LineBoundary | null {
  const threshold = pointerWorldThreshold();
  for (let index = state.lineBoundaries.length - 1; index >= 0; index -= 1) {
    const line = state.lineBoundaries[index];
    const vertices = getLineVertices(line);
    let hit = false;
    for (let i = 0; i < vertices.length - 1; i += 1) {
      if (distancePointToSegment(point, vertices[i], vertices[i + 1]) <= threshold) {
        hit = true;
        break;
      }
    }
    if (hit) {
      return line;
    }
  }
  return null;
}

function syncModifierState(event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean }): void {
  state.modifiers.alt = event.altKey;
  state.modifiers.ctrl = event.ctrlKey;
  state.modifiers.meta = event.metaKey;
}

function updateCanvasCursor(point = state.hoverPoint): void {
  let cursor = 'default';
  let mode = 'default';
  const hasPoint = point !== null;
  const selectedLineId = state.selected?.kind === 'line' ? state.selected.id : null;
  const selectedPolygonId = state.selected?.kind === 'polygon' ? state.selected.id : null;

  if (state.camera.panMode) {
    cursor = state.drag.type === 'pan' ? 'grabbing' : 'grab';
    mode = state.drag.type === 'pan' ? 'pan-drag' : 'pan';
  } else if (state.tool === 'select') {
    if (
      state.drag.type === 'line-vertex' ||
      state.drag.type === 'line-move' ||
      state.drag.type === 'polygon-move' ||
      state.drag.type === 'polygon-vertex'
    ) {
      cursor = 'grabbing';
      mode = 'dragging';
    } else if (
      hasPoint &&
      (state.modifiers.ctrl || state.modifiers.meta) &&
      ((selectedLineId !== null &&
        findLineVertex(point, selectedLineId) &&
        (() => {
          const line = state.lineBoundaries.find((item) => item.id === selectedLineId);
          return line ? getLineVertices(line).length > 2 : false;
        })()) ||
        (selectedPolygonId !== null &&
          findPolygonVertex(point, selectedPolygonId) &&
          (state.polygons.find((polygon) => polygon.id === selectedPolygonId)?.vertices.length ?? 3) > 3))
    ) {
      cursor = CURSOR_MINUS;
      mode = 'minus';
    } else if (
      hasPoint &&
      state.modifiers.alt &&
      ((selectedLineId !== null && findLineEdge(point, selectedLineId)) ||
        (selectedPolygonId !== null && findPolygonEdge(point, selectedPolygonId)))
    ) {
      cursor = CURSOR_PLUS;
      mode = 'plus';
    } else if (hasPoint && (findPolygonVertex(point) || findLineVertex(point))) {
      cursor = 'grab';
      mode = 'handle';
    } else if (hasPoint && (findPolygon(point) || findLine(point))) {
      cursor = 'move';
      mode = 'move';
    }
  } else if (state.tool === 'standpipe') {
    cursor = state.drag.type === 'standpipe-move' ? 'grabbing' : 'crosshair';
    mode = state.drag.type === 'standpipe-move' ? 'standpipe-drag' : 'standpipe';
  } else {
    cursor = 'crosshair';
    mode = 'draw';
  }

  updateCursorReadout(point);
  canvas.style.cursor = cursor;
  canvas.dataset.cursorMode = mode;
}

function updateCursorReadout(point = state.hoverPoint): void {
  const transformed = transformedCoordinatesActive();
  const xLabel = transformed ? "x'" : 'x';
  const yLabel = transformed ? "y'" : 'y';

  if (!point) {
    cursorReadout.textContent = `${xLabel}: -, ${yLabel}: -`;
    return;
  }

  const displayPoint = mapPointToDisplay(point);
  cursorReadout.textContent = `${xLabel}: ${displayPoint.x.toFixed(2)}, ${yLabel}: ${displayPoint.y.toFixed(2)}`;
}

function pointerWorldThreshold(): number {
  const view = getCanvasView();
  const worldPerPxX = view.bounds.width / view.viewport.width;
  const worldPerPxY = view.bounds.height / view.viewport.height;
  const basePixels = state.coarsePointer || state.lastPointerType === 'touch' ? 16 : 8;
  return basePixels * Math.max(worldPerPxX, worldPerPxY);
}

function eventToCanvasPoint(event: PointerEvent | WheelEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function pointInViewport(point: Point, viewport: Viewport): boolean {
  return (
    point.x >= viewport.left &&
    point.x <= viewport.left + viewport.width &&
    point.y >= viewport.top &&
    point.y <= viewport.top + viewport.height
  );
}

function clampPoint(point: Point): Point {
  return {
    x: clamp(point.x, 0, state.domain.width),
    y: clamp(point.y, 0, state.domain.height),
  };
}

function polygonBoundsFromVertices(vertices: Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  vertices.forEach((vertex) => {
    minX = Math.min(minX, vertex.x);
    maxX = Math.max(maxX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxY = Math.max(maxY, vertex.y);
  });
  return { minX, maxX, minY, maxY };
}

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function scheduleSolve(delay = 120): void {
  if (!state.view.autoSolve) {
    updateStandpipeReading();
    render();
    return;
  }

  if (solveTimer !== null) {
    window.clearTimeout(solveTimer);
  }

  solveTimer = window.setTimeout(() => {
    solveTimer = null;
    solveAndRender();
  }, delay);
}

function solveAndRender(): void {
  state.solution = solveGroundwater(state.domain, state.solver, state.view, state.lineBoundaries, state.polygons);
  updateStandpipeReading();

  const anisotropyRatio = state.solver.kx / state.solver.ky;
  const anisotropyLabel = Math.abs(anisotropyRatio - 1) < 1e-6
    ? 'isotropic (orthogonality expected)'
    : `anisotropic (Kx/Ky=${anisotropyRatio.toFixed(2)})`;

  const convergenceLabel = state.solution.converged
    ? 'converged'
    : 'hit max iterations';

  const anchorNote = state.solution.anchoredNode
    ? ' | anchored one node (all-Neumann case)'
    : '';

  statusText.textContent = `Solved: ${convergenceLabel}, ${state.solution.iterations} iters, residual ${state.solution.residual.toExponential(2)}, ${anisotropyLabel}${anchorNote}.`;
  render();
}

function updateGuidanceUI(): void {
  const hints: Record<Tool, string> = {
    select: 'Select and drag endpoints/lines/polygons to edit geometry and BCs.',
    equipotential: 'Draw a fixed-head equipotential (EP) line.',
    phreatic: 'Draw a user-defined phreatic line (head = elevation).',
    'noflow-line': 'Draw an impermeable no-flow line.',
    'noflow-zone': 'Draw an impermeable no-flow polygon.',
    standpipe: 'Click or drag to place/move the standpipe and read pressure head and rise.',
  };
  toolHint.textContent = hints[state.tool];
  newHeadWrap.classList.toggle('is-hidden', state.tool !== 'equipotential');

  let stepText = '';
  if (state.camera.panMode) {
    stepText = 'Pan mode: drag the canvas to move view. Use + / - (or wheel) to zoom, then Fit to reset.';
  } else if (state.tool === 'select') {
    stepText =
      'Click a boundary/polygon to move. Drag orange handles to reshape; Alt+click an edge of the selected item to add a vertex; Ctrl/Cmd+click a vertex of the selected item to delete.';
  } else if (state.tool === 'equipotential' || state.tool === 'phreatic' || state.tool === 'noflow-line') {
    stepText = state.pendingLineStart
      ? 'Step 2 of 2: click second endpoint to finish this line. Press Esc to cancel.'
      : 'Step 1 of 2: click first endpoint for a new line.';
  } else if (state.tool === 'noflow-zone') {
    stepText = state.drag.type === 'polygon-draw'
      ? 'Step 2 of 2: drag and release to set initial polygon size. Press Esc to cancel.'
      : 'Step 1 of 2: click and drag to create an initial polygon.';
  } else {
    stepText = 'Step 1 of 1: click or drag inside active soil to place/move the standpipe.';
  }

  toolStep.textContent = stepText;
  zoomLabel.textContent = `${Math.round(state.camera.zoom * 100)}%`;
  panModeBtn.textContent = state.camera.panMode ? 'Pan: On' : 'Pan: Off';
  panModeBtn.classList.toggle('is-active', state.camera.panMode);
}

function updateBoundaryInventory(): void {
  const lines = [...state.lineBoundaries].sort((a, b) => a.id - b.id);
  const polygons = [...state.polygons].sort((a, b) => a.id - b.id);

  inventorySummary.textContent = `${lines.length} line BCs + ${polygons.length} no-flow polygons`;
  inventoryList.innerHTML = '';

  if (lines.length === 0 && polygons.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'inventory-empty';
    emptyState.textContent = 'No boundaries added yet.';
    inventoryList.appendChild(emptyState);
    return;
  }

  lines.forEach((line) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-item';
    if (state.selected?.kind === 'line' && state.selected.id === line.id) {
      button.classList.add('is-selected');
    }

    const label = line.kind === 'equipotential'
      ? `EP #${line.id} (h=${line.head.toFixed(2)}m)`
      : line.kind === 'phreatic'
        ? `Phreatic #${line.id}`
        : `No-flow line #${line.id}`;

    button.textContent = label;
    button.addEventListener('click', () => {
      state.selected = { kind: 'line', id: line.id };
      updateSelectionPanel();
      render();
    });
    inventoryList.appendChild(button);
  });

  polygons.forEach((polygon) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-item';
    if (state.selected?.kind === 'polygon' && state.selected.id === polygon.id) {
      button.classList.add('is-selected');
    }
    button.textContent = `No-flow polygon #${polygon.id} (${polygon.vertices.length} vertices)`;
    button.addEventListener('click', () => {
      state.selected = { kind: 'polygon', id: polygon.id };
      updateSelectionPanel();
      render();
    });
    inventoryList.appendChild(button);
  });
}

function updateSelectionPanel(): void {
  if (!state.selected) {
    selectionType.textContent = 'Nothing selected.';
    selectedHeadRow.classList.add('is-hidden');
    deleteBtn.classList.add('is-hidden');
    updateBoundaryInventory();
    updateGuidanceUI();
    return;
  }

  if (state.selected.kind === 'line') {
    const line = state.lineBoundaries.find((item) => item.id === state.selected?.id);
    if (!line) {
      selectionType.textContent = 'Nothing selected.';
      selectedHeadRow.classList.add('is-hidden');
      deleteBtn.classList.add('is-hidden');
      updateBoundaryInventory();
      updateGuidanceUI();
      return;
    }
    const label = line.kind === 'equipotential'
      ? 'Equipotential line'
      : line.kind === 'phreatic'
        ? 'Phreatic line'
        : 'No-flow line';
    selectionType.textContent = `${label} #${line.id}`;
    if (line.kind === 'equipotential') {
      selectedHeadRow.classList.remove('is-hidden');
      selectedHeadInput.value = String(line.head);
    } else {
      selectedHeadRow.classList.add('is-hidden');
    }
    deleteBtn.classList.remove('is-hidden');
    updateBoundaryInventory();
    updateGuidanceUI();
    return;
  }

  const polygon = state.polygons.find((item) => item.id === state.selected?.id);
  if (!polygon) {
    selectionType.textContent = 'Nothing selected.';
    selectedHeadRow.classList.add('is-hidden');
    deleteBtn.classList.add('is-hidden');
    updateBoundaryInventory();
    updateGuidanceUI();
    return;
  }
  selectionType.textContent = `No-flow polygon #${polygon.id} (${polygon.vertices.length} vertices)`;
  selectedHeadRow.classList.add('is-hidden');
  deleteBtn.classList.remove('is-hidden');
  updateBoundaryInventory();
  updateGuidanceUI();
}

function updateStandpipeReading(): void {
  if (!state.standpipePoint || !state.solution) {
    state.standpipeReading = null;
    standpipeText.textContent = 'Choose the standpipe tool and click inside the domain.';
    return;
  }

  const head = interpolateScalar(state.solution.heads, state.solution.active, state.domain, state.solver, state.standpipePoint);
  if (head === null) {
    state.standpipeReading = null;
    standpipeText.textContent = 'Standpipe is in an impermeable/no-flow region. Move it into active soil.';
    return;
  }

  const rise = head - state.standpipePoint.y;
  state.standpipeReading = {
    point: { ...state.standpipePoint },
    head,
    rise,
  };

  standpipeText.textContent = `Point (${state.standpipePoint.x.toFixed(2)}m, ${state.standpipePoint.y.toFixed(2)}m): head ${head.toFixed(2)}m, water rise ${rise.toFixed(2)}m above tip.`;
}

function solveGroundwater(
  domain: DomainSettings,
  solver: SolverSettings,
  view: ViewSettings,
  lineBoundaries: LineBoundary[],
  polygons: NoFlowPolygon[],
): Solution {
  const { nx, ny, kx, ky, maxIter, tolerance, omega } = solver;
  const dx = domain.width / (nx - 1);
  const dy = domain.height / (ny - 1);

  const heads = Array.from({ length: ny }, () => Array.from({ length: nx }, () => 0));
  const active = Array.from({ length: ny }, () => Array.from({ length: nx }, () => true));
  const dirichlet = Array.from({ length: ny }, () => Array.from({ length: nx }, () => false));

  const noFlowLines = lineBoundaries.filter((line) => line.kind === 'noflow');
  const fixedLines = lineBoundaries.filter((line) => line.kind === 'equipotential' || line.kind === 'phreatic');

  const bandThickness = 0.5 * Math.min(dx, dy);
  const noFlowPaddingCells = 1;
  const noFlowMask = Array.from({ length: ny }, () => Array.from({ length: nx }, () => false));

  noFlowLines.forEach((line) => {
    const nodes = rasterizeBoundaryLineNodes(line, domain, solver, noFlowPaddingCells);
    nodes.forEach(({ i, j }) => {
      noFlowMask[j][i] = true;
    });
  });

  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const point = { x: i * dx, y: j * dy };
      if (noFlowMask[j][i]) {
        active[j][i] = false;
        continue;
      }
      if (
        polygons.some((polygon) =>
          pointInPolygon(point, polygon.vertices) ||
          distancePointToPolygonEdges(point, polygon.vertices) <= bandThickness,
        )
      ) {
        active[j][i] = false;
      }
    }
  }

  let dirichletCount = 0;
  let fixedHeadSum = 0;

  fixedLines.forEach((line) => {
    const lineVertices = getLineVertices(line);
    const nodes = rasterizeBoundaryLineNodes(line, domain, solver, 0);
    nodes.forEach(({ i, j }) => {
      if (!active[j][i]) {
        return;
      }
      const point = { x: i * dx, y: j * dy };
      const projection = projectPointToPolyline(point, lineVertices);
      const value = line.kind === 'equipotential' ? line.head : projection.y;
      if (!dirichlet[j][i]) {
        dirichletCount += 1;
      }
      dirichlet[j][i] = true;
      heads[j][i] = value;
    });
  });

  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      if (dirichlet[j][i] && active[j][i]) {
        fixedHeadSum += heads[j][i];
      }
    }
  }

  let anchoredNode = false;
  if (dirichletCount === 0) {
    for (let j = 0; j < ny && dirichletCount === 0; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        if (!active[j][i]) {
          continue;
        }
        dirichlet[j][i] = true;
        heads[j][i] = 0;
        dirichletCount = 1;
        anchoredNode = true;
        fixedHeadSum = 0;
        break;
      }
    }
  }

  const initHead = dirichletCount > 0 ? fixedHeadSum / dirichletCount : 0;

  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      if (active[j][i] && !dirichlet[j][i]) {
        heads[j][i] = initHead;
      }
    }
  }

  const aX = kx / (dx * dx);
  const aY = ky / (dy * dy);

  let converged = false;
  let residual = Number.POSITIVE_INFINITY;
  let iterations = 0;

  for (let iter = 1; iter <= maxIter; iter += 1) {
    let maxDelta = 0;

    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        if (!active[j][i] || dirichlet[j][i]) {
          continue;
        }

        let coeff = 0;
        let rhs = 0;

        if (i + 1 < nx && active[j][i + 1]) {
          coeff += aX;
          rhs += aX * heads[j][i + 1];
        }

        if (i - 1 >= 0 && active[j][i - 1]) {
          coeff += aX;
          rhs += aX * heads[j][i - 1];
        }

        if (j + 1 < ny && active[j + 1][i]) {
          coeff += aY;
          rhs += aY * heads[j + 1][i];
        }

        if (j - 1 >= 0 && active[j - 1][i]) {
          coeff += aY;
          rhs += aY * heads[j - 1][i];
        }

        if (coeff <= 0) {
          continue;
        }

        const candidate = rhs / coeff;
        const updated = (1 - omega) * heads[j][i] + omega * candidate;
        const delta = Math.abs(updated - heads[j][i]);
        if (delta > maxDelta) {
          maxDelta = delta;
        }
        heads[j][i] = updated;
      }
    }

    residual = maxDelta;
    iterations = iter;
    if (maxDelta < tolerance) {
      converged = true;
      break;
    }
  }

  const qx = Array.from({ length: ny }, () => Array.from({ length: nx }, () => 0));
  const qy = Array.from({ length: ny }, () => Array.from({ length: nx }, () => 0));

  let minHead = Number.POSITIVE_INFINITY;
  let maxHead = Number.NEGATIVE_INFINITY;

  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      if (!active[j][i]) {
        continue;
      }

      minHead = Math.min(minHead, heads[j][i]);
      maxHead = Math.max(maxHead, heads[j][i]);

      const gradX = nodeDerivativeX(heads, active, i, j, dx);
      const gradY = nodeDerivativeY(heads, active, i, j, dy);
      qx[j][i] = -kx * gradX;
      qy[j][i] = -ky * gradY;
    }
  }

  if (!Number.isFinite(minHead) || !Number.isFinite(maxHead)) {
    minHead = 0;
    maxHead = 0;
  }

  const contourLevels = buildContourLevels(minHead, maxHead, view.contours);
  const contourSegments = contourLevels.length > 0
    ? marchingSquares(heads, active, domain, solver, contourLevels)
    : [];

  const streamPaths = computeStreamlines(domain, solver, qx, qy, active, lineBoundaries, view.streamlines);

  return {
    heads,
    active,
    dirichlet,
    qx,
    qy,
    iterations,
    converged,
    residual,
    minHead,
    maxHead,
    contourLevels,
    contourSegments,
    streamPaths,
    anchoredNode,
  };
}

function nodeDerivativeX(heads: number[][], active: boolean[][], i: number, j: number, dx: number): number {
  const nx = heads[0].length;
  const leftOk = i - 1 >= 0 && active[j][i - 1];
  const rightOk = i + 1 < nx && active[j][i + 1];

  if (leftOk && rightOk) {
    return (heads[j][i + 1] - heads[j][i - 1]) / (2 * dx);
  }

  if (rightOk) {
    return (heads[j][i + 1] - heads[j][i]) / dx;
  }

  if (leftOk) {
    return (heads[j][i] - heads[j][i - 1]) / dx;
  }

  return 0;
}

function nodeDerivativeY(heads: number[][], active: boolean[][], i: number, j: number, dy: number): number {
  const ny = heads.length;
  const downOk = j - 1 >= 0 && active[j - 1][i];
  const upOk = j + 1 < ny && active[j + 1][i];

  if (downOk && upOk) {
    return (heads[j + 1][i] - heads[j - 1][i]) / (2 * dy);
  }

  if (upOk) {
    return (heads[j + 1][i] - heads[j][i]) / dy;
  }

  if (downOk) {
    return (heads[j][i] - heads[j - 1][i]) / dy;
  }

  return 0;
}

function buildContourLevels(minHead: number, maxHead: number, count: number): number[] {
  if (count <= 0) {
    return [];
  }
  const span = maxHead - minHead;
  if (span < 1e-8) {
    return [];
  }
  const step = span / (count + 1);
  const levels: number[] = [];
  for (let idx = 1; idx <= count; idx += 1) {
    levels.push(minHead + step * idx);
  }
  return levels;
}

function marchingSquares(
  heads: number[][],
  active: boolean[][],
  domain: DomainSettings,
  solver: SolverSettings,
  levels: number[],
): ContourSegment[] {
  const segments: ContourSegment[] = [];
  const dx = domain.width / (solver.nx - 1);
  const dy = domain.height / (solver.ny - 1);

  for (let j = 0; j < solver.ny - 1; j += 1) {
    for (let i = 0; i < solver.nx - 1; i += 1) {
      const activeCorners = active[j][i] && active[j][i + 1] && active[j + 1][i + 1] && active[j + 1][i];
      if (!activeCorners) {
        continue;
      }

      const p0 = { x: i * dx, y: j * dy };
      const p1 = { x: (i + 1) * dx, y: j * dy };
      const p2 = { x: (i + 1) * dx, y: (j + 1) * dy };
      const p3 = { x: i * dx, y: (j + 1) * dy };

      const v0 = heads[j][i];
      const v1 = heads[j][i + 1];
      const v2 = heads[j + 1][i + 1];
      const v3 = heads[j + 1][i];

      levels.forEach((level) => {
        const index =
          (v0 >= level ? 1 : 0) |
          (v1 >= level ? 2 : 0) |
          (v2 >= level ? 4 : 0) |
          (v3 >= level ? 8 : 0);

        const edgePairs = marchingCases[index];
        if (!edgePairs || edgePairs.length === 0) {
          return;
        }

        edgePairs.forEach(([edgeA, edgeB]) => {
          const a = interpolateEdge(level, edgeA, p0, p1, p2, p3, v0, v1, v2, v3);
          const b = interpolateEdge(level, edgeB, p0, p1, p2, p3, v0, v1, v2, v3);
          if (a && b) {
            segments.push({ level, a, b });
          }
        });
      });
    }
  }

  return segments;
}

function interpolateEdge(
  level: number,
  edge: number,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  v0: number,
  v1: number,
  v2: number,
  v3: number,
): Point | null {
  switch (edge) {
    case 0:
      return lerpPoint(level, p0, p1, v0, v1);
    case 1:
      return lerpPoint(level, p1, p2, v1, v2);
    case 2:
      return lerpPoint(level, p2, p3, v2, v3);
    case 3:
      return lerpPoint(level, p3, p0, v3, v0);
    default:
      return null;
  }
}

function lerpPoint(level: number, a: Point, b: Point, va: number, vb: number): Point {
  const denom = vb - va;
  if (Math.abs(denom) < 1e-12) {
    return { x: 0.5 * (a.x + b.x), y: 0.5 * (a.y + b.y) };
  }
  const t = clamp((level - va) / denom, 0, 1);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function computeStreamlines(
  domain: DomainSettings,
  solver: SolverSettings,
  qx: number[][],
  qy: number[][],
  active: boolean[][],
  lineBoundaries: LineBoundary[],
  count: number,
): Point[][] {
  const seeds = buildSeeds(domain, solver, active, lineBoundaries, count);
  const lines: Point[][] = [];

  seeds.forEach((seed) => {
    const forward = traceStream(seed, 1, domain, solver, qx, qy, active);
    const backward = traceStream(seed, -1, domain, solver, qx, qy, active).reverse();

    const merged = [...backward, ...forward.slice(1)];
    if (merged.length >= 3) {
      lines.push(merged);
    }
  });

  return lines;
}

function buildSeeds(
  domain: DomainSettings,
  solver: SolverSettings,
  active: boolean[][],
  lineBoundaries: LineBoundary[],
  count: number,
): Point[] {
  const equipotentialLines = lineBoundaries.filter((line) => line.kind === 'equipotential');
  let seedLine: LineBoundary | null = null;

  for (const line of equipotentialLines) {
    if (seedLine === null || line.head > seedLine.head) {
      seedLine = line;
    }
  }

  const seeds: Point[] = [];
  const stepNudge = 0.4 * Math.min(domain.width / (solver.nx - 1), domain.height / (solver.ny - 1));
  const center = { x: 0.5 * domain.width, y: 0.5 * domain.height };
  for (let idx = 1; idx <= count; idx += 1) {
    const t = idx / (count + 1);
    const base = seedLine !== null
      ? samplePointOnPolyline(getLineVertices(seedLine), t)
      : { x: 0, y: t * domain.height };

    const towardCenter = normalize({ x: center.x - base.x, y: center.y - base.y });
    const candidate = clampPoint({
      x: base.x + towardCenter.x * stepNudge,
      y: base.y + towardCenter.y * stepNudge,
    });

    if (isPointActive(candidate, domain, solver, active)) {
      seeds.push(candidate);
    }
  }

  return seeds;
}

function traceStream(
  seed: Point,
  direction: 1 | -1,
  domain: DomainSettings,
  solver: SolverSettings,
  qx: number[][],
  qy: number[][],
  active: boolean[][],
): Point[] {
  const points: Point[] = [seed];
  const stepLength = 0.35 * Math.min(domain.width / (solver.nx - 1), domain.height / (solver.ny - 1));
  const maxSteps = 2400;

  for (let step = 0; step < maxSteps; step += 1) {
    const current = points[points.length - 1];
    const velocity = interpolateVectorField(qx, qy, active, domain, solver, current);
    if (!velocity) {
      break;
    }

    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed < 1e-9) {
      break;
    }

    const dt = (direction * stepLength) / speed;
    const midPoint = {
      x: current.x + 0.5 * velocity.x * dt,
      y: current.y + 0.5 * velocity.y * dt,
    };

    const midVelocity = interpolateVectorField(qx, qy, active, domain, solver, midPoint);
    if (!midVelocity) {
      break;
    }

    const next = {
      x: current.x + midVelocity.x * dt,
      y: current.y + midVelocity.y * dt,
    };

    if (next.x < 0 || next.x > domain.width || next.y < 0 || next.y > domain.height) {
      break;
    }

    if (!isPointActive(next, domain, solver, active)) {
      break;
    }

    if (distance(current, next) < 1e-6) {
      break;
    }

    points.push(next);
  }

  return points;
}

function interpolateVectorField(
  qx: number[][],
  qy: number[][],
  active: boolean[][],
  domain: DomainSettings,
  solver: SolverSettings,
  point: Point,
): Point | null {
  if (point.x < 0 || point.x > domain.width || point.y < 0 || point.y > domain.height) {
    return null;
  }

  const dx = domain.width / (solver.nx - 1);
  const dy = domain.height / (solver.ny - 1);

  const gx = point.x / dx;
  const gy = point.y / dy;

  const i0 = clamp(Math.floor(gx), 0, solver.nx - 2);
  const j0 = clamp(Math.floor(gy), 0, solver.ny - 2);
  const i1 = i0 + 1;
  const j1 = j0 + 1;

  const tx = clamp(gx - i0, 0, 1);
  const ty = clamp(gy - j0, 0, 1);

  const nodes = [
    { i: i0, j: j0, w: (1 - tx) * (1 - ty) },
    { i: i1, j: j0, w: tx * (1 - ty) },
    { i: i1, j: j1, w: tx * ty },
    { i: i0, j: j1, w: (1 - tx) * ty },
  ];

  let weight = 0;
  let vx = 0;
  let vy = 0;

  nodes.forEach((node) => {
    if (!active[node.j][node.i]) {
      return;
    }
    weight += node.w;
    vx += node.w * qx[node.j][node.i];
    vy += node.w * qy[node.j][node.i];
  });

  if (weight < 1e-8) {
    return null;
  }

  return {
    x: vx / weight,
    y: vy / weight,
  };
}

function interpolateScalar(
  grid: number[][],
  active: boolean[][],
  domain: DomainSettings,
  solver: SolverSettings,
  point: Point,
): number | null {
  if (point.x < 0 || point.x > domain.width || point.y < 0 || point.y > domain.height) {
    return null;
  }

  const dx = domain.width / (solver.nx - 1);
  const dy = domain.height / (solver.ny - 1);

  const gx = point.x / dx;
  const gy = point.y / dy;

  const i0 = clamp(Math.floor(gx), 0, solver.nx - 2);
  const j0 = clamp(Math.floor(gy), 0, solver.ny - 2);
  const i1 = i0 + 1;
  const j1 = j0 + 1;

  const tx = clamp(gx - i0, 0, 1);
  const ty = clamp(gy - j0, 0, 1);

  const nodes = [
    { i: i0, j: j0, w: (1 - tx) * (1 - ty) },
    { i: i1, j: j0, w: tx * (1 - ty) },
    { i: i1, j: j1, w: tx * ty },
    { i: i0, j: j1, w: (1 - tx) * ty },
  ];

  let totalWeight = 0;
  let total = 0;

  nodes.forEach((node) => {
    if (!active[node.j][node.i]) {
      return;
    }
    totalWeight += node.w;
    total += node.w * grid[node.j][node.i];
  });

  if (totalWeight < 1e-8) {
    return null;
  }

  return total / totalWeight;
}

function isPointActive(point: Point, domain: DomainSettings, solver: SolverSettings, active: boolean[][]): boolean {
  if (point.x < 0 || point.x > domain.width || point.y < 0 || point.y > domain.height) {
    return false;
  }
  const dx = domain.width / (solver.nx - 1);
  const dy = domain.height / (solver.ny - 1);
  const i = clamp(Math.round(point.x / dx), 0, solver.nx - 1);
  const j = clamp(Math.round(point.y / dy), 0, solver.ny - 1);
  return active[j][i];
}

function render(): void {
  const rect = canvas.getBoundingClientRect();
  const view = getCanvasView();
  const viewport = view.viewport;
  updateCanvasPrompt(view);
  updateCursorReadout();

  ctx.font = '500 14px "Montserrat", sans-serif';

  ctx.clearRect(0, 0, rect.width, rect.height);

  const bg = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  bg.addColorStop(0, '#f6f8f4');
  bg.addColorStop(1, '#dde7ef');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.fillStyle = RENDER_STYLE.soilColor;
  ctx.fillRect(viewport.left, viewport.top, viewport.width, viewport.height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(viewport.left, viewport.top, viewport.width, viewport.height);
  ctx.clip();

  if (state.solution) {
    if (state.view.showHeadMap) {
      drawHeadShading(view, state.solution);
    }
    drawContourSegments(view, state.solution);
    drawStreamPaths(view, state.solution.streamPaths);
  }

  drawNoFlowPolygons(view);
  drawBoundaries(view);
  drawPendingShape(view);
  drawStandpipe(view);
  drawSelection(view);
  ctx.restore();

  drawDomainOutline(view);
  if (state.solution && state.view.showHeadMap) {
    drawHeadColorbar(view, state.solution);
  }
  drawSelectionHandles(view);
}

function updateCanvasPrompt(view: CanvasView): void {
  const displayBounds = mapBoundsToDisplay(view.bounds);
  const xMin = displayBounds.xMin.toFixed(1);
  const xMax = (displayBounds.xMin + displayBounds.width).toFixed(1);
  const yMin = displayBounds.yMin.toFixed(1);
  const yMax = (displayBounds.yMin + displayBounds.height).toFixed(1);
  const modeLabel = state.view.coordinateMode === 'transformed' ? 'transformed' : 'real';
  canvasPrompt.textContent = `View x:${xMin}-${xMax}m y:${yMin}-${yMax}m | coords: ${modeLabel}`;
}

function drawDomainOutline(view: CanvasView): void {
  const { viewport, bounds } = view;
  const displayBounds = mapBoundsToDisplay(bounds);
  const xSuffix = transformedCoordinatesActive() ? " x'" : ' m';
  const ySuffix = transformedCoordinatesActive() ? " y'" : ' m';
  ctx.strokeStyle = '#213547';
  ctx.lineWidth = 2;
  ctx.strokeRect(viewport.left, viewport.top, viewport.width, viewport.height);

  ctx.fillStyle = '#102332';
  const xMin = displayBounds.xMin.toFixed(1);
  const xMax = (displayBounds.xMin + displayBounds.width).toFixed(1);
  const yMax = (displayBounds.yMin + displayBounds.height).toFixed(1);
  const axisY = viewport.top + viewport.height + 5;

  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(xMin, viewport.left + 2, axisY);

  ctx.textAlign = 'right';
  ctx.fillText(`${xMax}${xSuffix}`, viewport.left + viewport.width - 2, axisY);

  ctx.textAlign = 'left';
  ctx.fillText(`${yMax}${ySuffix}`, viewport.left + 4, viewport.top + 2);
  ctx.restore();
}

function drawHeadShading(view: CanvasView, solution: Solution): void {
  const { heads, active, minHead, maxHead } = solution;
  const nx = state.solver.nx;
  const ny = state.solver.ny;
  const dx = state.domain.width / (nx - 1);
  const dy = state.domain.height / (ny - 1);
  const xMax = view.bounds.xMin + view.bounds.width;
  const yMax = view.bounds.yMin + view.bounds.height;

  if (maxHead - minHead < 1e-9) {
    return;
  }

  for (let j = 0; j < ny - 1; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const activeCell = active[j][i] && active[j][i + 1] && active[j + 1][i] && active[j + 1][i + 1];
      if (!activeCell) {
        continue;
      }

      const x0 = i * dx;
      const x1 = (i + 1) * dx;
      const y0 = j * dy;
      const y1 = (j + 1) * dy;
      if (x1 < view.bounds.xMin || x0 > xMax || y1 < view.bounds.yMin || y0 > yMax) {
        continue;
      }

      const hAvg = 0.25 * (heads[j][i] + heads[j][i + 1] + heads[j + 1][i] + heads[j + 1][i + 1]);
      ctx.fillStyle = headColor(hAvg, minHead, maxHead);
      const topLeft = worldToScreen({ x: x0, y: y1 }, view);
      const bottomRight = worldToScreen({ x: x1, y: y0 }, view);
      ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x + 0.8, bottomRight.y - topLeft.y + 0.8);
    }
  }
}

function drawContourSegments(view: CanvasView, solution: Solution): void {
  if (solution.contourSegments.length === 0) {
    return;
  }

  ctx.strokeStyle = RENDER_STYLE.equipotentialColor;
  ctx.lineWidth = RENDER_STYLE.equipotentialWidth;
  ctx.lineCap = 'round';

  solution.contourSegments.forEach((segment) => {
    const a = worldToScreen(segment.a, view);
    const b = worldToScreen(segment.b, view);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
}

function drawStreamPaths(view: CanvasView, lines: Point[][]): void {
  ctx.strokeStyle = RENDER_STYLE.flowLineColor;
  ctx.lineWidth = RENDER_STYLE.flowLineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  lines.forEach((line) => {
    if (line.length < 2) {
      return;
    }
    const first = worldToScreen(line[0], view);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let idx = 1; idx < line.length; idx += 1) {
      const point = worldToScreen(line[idx], view);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  });
}

function drawNoFlowPolygons(view: CanvasView): void {
  state.polygons.forEach((polygon) => {
    if (polygon.vertices.length < 3) {
      return;
    }
    const screenVertices = polygon.vertices.map((vertex) => worldToScreen(vertex, view));
    ctx.beginPath();
    ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
    for (let idx = 1; idx < screenVertices.length; idx += 1) {
      ctx.lineTo(screenVertices[idx].x, screenVertices[idx].y);
    }
    ctx.closePath();
    ctx.fillStyle = RENDER_STYLE.noFlowColor;
    ctx.fill();
    ctx.strokeStyle = RENDER_STYLE.noFlowColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });
}

function placeLabelNearAnchor(
  text: string,
  anchor: Point,
  view: CanvasView,
  options?: { offsetX?: number; offsetY?: number; downOffset?: number; margin?: number },
): Point {
  const offsetX = options?.offsetX ?? 6;
  const offsetY = options?.offsetY ?? 6;
  const downOffset = options?.downOffset ?? 14;
  const margin = options?.margin ?? 8;
  const right = view.viewport.left + view.viewport.width;
  const bottom = view.viewport.top + view.viewport.height;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || 8;
  const descent = metrics.actualBoundingBoxDescent || 3;

  let x = anchor.x + offsetX;
  if (x + textWidth > right - margin) {
    x = anchor.x - offsetX - textWidth;
  }
  x = clamp(x, view.viewport.left + margin, right - margin - textWidth);

  let y = anchor.y - offsetY;
  if (y - ascent < view.viewport.top + margin) {
    y = anchor.y + downOffset;
  }
  y = clamp(y, view.viewport.top + margin + ascent, bottom - margin - descent);

  return { x, y };
}

function drawBoundaries(view: CanvasView): void {
  state.lineBoundaries.forEach((line) => {
    const lineVertices = getLineVertices(line);
    if (lineVertices.length < 2) {
      return;
    }

    if (line.kind === 'equipotential') {
      ctx.setLineDash([]);
      ctx.strokeStyle = RENDER_STYLE.equipotentialColor;
      ctx.lineWidth = RENDER_STYLE.equipotentialWidth;
    } else if (line.kind === 'phreatic') {
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = RENDER_STYLE.phreaticColor;
      ctx.lineWidth = RENDER_STYLE.equipotentialWidth;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = RENDER_STYLE.noFlowColor;
      ctx.lineWidth = RENDER_STYLE.equipotentialWidth;
    }

    const first = worldToScreen(lineVertices[0], view);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < lineVertices.length; i += 1) {
      const point = worldToScreen(lineVertices[i], view);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const mid = worldToScreen(samplePointOnPolyline(lineVertices, 0.5), view);
    ctx.fillStyle = '#111827';
    let label = '';

    if (line.kind === 'equipotential') {
      label = `EP ${line.head.toFixed(1)}m`;
    } else if (line.kind === 'phreatic') {
      label = 'Phreatic';
    } else {
      label = 'No-flow';
    }
    const labelPos = placeLabelNearAnchor(label, mid, view);
    ctx.fillText(label, labelPos.x, labelPos.y);
  });
}

function drawHeadColorbar(view: CanvasView, solution: Solution): void {
  const { minHead, maxHead } = solution;
  if (maxHead - minHead < 1e-9) {
    return;
  }

  const barWidth = 14;
  const barHeight = Math.max(110, Math.min(180, Math.round(view.viewport.height * 0.42)));
  const x = view.viewport.left + view.viewport.width - barWidth - 14;
  const y = view.viewport.top + 16;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
  ctx.fillRect(x - 24, y - 12, 86, barHeight + 24);

  const gradient = ctx.createLinearGradient(0, y + barHeight, 0, y);
  gradient.addColorStop(0, headColor(minHead, minHead, maxHead));
  gradient.addColorStop(0.5, headColor(0.5 * (minHead + maxHead), minHead, maxHead));
  gradient.addColorStop(1, headColor(maxHead, minHead, maxHead));
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, barWidth, barHeight);

  ctx.strokeStyle = 'rgba(248, 250, 252, 0.95)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barWidth, barHeight);

  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${maxHead.toFixed(2)} m`, x + barWidth + 7, y + 1);
  ctx.fillText(`${(0.5 * (maxHead + minHead)).toFixed(2)} m`, x + barWidth + 7, y + 0.5 * barHeight);
  ctx.fillText(`${minHead.toFixed(2)} m`, x + barWidth + 7, y + barHeight - 1);
  ctx.textBaseline = 'bottom';
  ctx.fillText('Head', x - 2, y - 4);
  ctx.restore();
}

function drawPendingShape(view: CanvasView): void {
  if (state.pendingLineStart && state.previewPoint) {
    const start = worldToScreen(state.pendingLineStart, view);
    const end = worldToScreen(state.previewPoint, view);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.drag.type === 'polygon-draw') {
    const previewVertices = rectangleVerticesFromDrag(state.drag.start, state.drag.current);
    if (!previewVertices) {
      return;
    }

    const screenVertices = previewVertices.map((vertex) => worldToScreen(vertex, view));
    ctx.beginPath();
    ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
    for (let idx = 1; idx < screenVertices.length; idx += 1) {
      ctx.lineTo(screenVertices[idx].x, screenVertices[idx].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(30, 41, 59, 0.14)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawStandpipe(view: CanvasView): void {
  if (!state.standpipePoint) {
    return;
  }

  const p = worldToScreen(state.standpipePoint, view);
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4.2, 0, Math.PI * 2);
  ctx.fill();

  const waterYWorld = state.standpipeReading
    ? clamp(state.standpipeReading.head, 0, state.domain.height)
    : state.standpipePoint.y;
  const waterPt = worldToScreen({ x: state.standpipePoint.x, y: waterYWorld }, view);

  const tubeX = p.x + 18;
  const tubeHalfWidth = 5;
  const leftX = tubeX - tubeHalfWidth;
  const rightX = tubeX + tubeHalfWidth;
  const topY = Math.min(waterPt.y, p.y) - 12;
  const bottomY = Math.max(p.y + 22, waterPt.y + 10);

  const waterY = clamp(waterPt.y, topY + 1, bottomY - 1);
  const innerLeft = leftX + 1.2;
  const innerWidth = (rightX - leftX) - 2.4;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(innerLeft, topY + 1, innerWidth, Math.max(0, waterY - topY - 1));

  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(innerLeft, waterY, innerWidth, Math.max(0, bottomY - waterY - 1));

  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(tubeX, p.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(leftX + 1, waterY);
  ctx.lineTo(rightX - 1, waterY);
  ctx.stroke();

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftX, topY);
  ctx.lineTo(leftX, bottomY);
  ctx.moveTo(rightX, topY);
  ctx.lineTo(rightX, bottomY);
  ctx.stroke();

  if (!state.standpipeReading) {
    return;
  }

  ctx.fillStyle = '#0f172a';
  const standpipeLabel = `h=${state.standpipeReading.head.toFixed(2)}m`;
  const standpipeLabelPos = placeLabelNearAnchor(
    standpipeLabel,
    { x: rightX, y: topY },
    view,
    { offsetX: 8, offsetY: 3, downOffset: 16 },
  );
  ctx.fillText(standpipeLabel, standpipeLabelPos.x, standpipeLabelPos.y);
}

function drawSelection(view: CanvasView): void {
  if (!state.selected) {
    return;
  }

  if (state.selected.kind === 'line') {
    const line = state.lineBoundaries.find((item) => item.id === state.selected?.id);
    if (!line) {
      return;
    }

    const lineVertices = getLineVertices(line);
    if (lineVertices.length < 2) {
      return;
    }
    const first = worldToScreen(lineVertices[0], view);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < lineVertices.length; i += 1) {
      const point = worldToScreen(lineVertices[i], view);
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  const polygon = state.polygons.find((item) => item.id === state.selected?.id);
  if (!polygon || polygon.vertices.length < 3) {
    return;
  }

  const screenVertices = polygon.vertices.map((vertex) => worldToScreen(vertex, view));

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
  for (let idx = 1; idx < screenVertices.length; idx += 1) {
    ctx.lineTo(screenVertices[idx].x, screenVertices[idx].y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawSelectionHandles(view: CanvasView): void {
  if (!state.selected) {
    return;
  }

  const handleRadius = state.coarsePointer || state.lastPointerType === 'touch' ? 8 : 5;
  const drawHandle = (handle: Point): void => {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, handleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  if (state.selected.kind === 'line') {
    const line = state.lineBoundaries.find((item) => item.id === state.selected?.id);
    if (!line) {
      return;
    }
    getLineVertices(line).forEach((vertex) => {
      drawHandle(worldToScreen(vertex, view));
    });
    return;
  }

  const polygon = state.polygons.find((item) => item.id === state.selected?.id);
  if (!polygon || polygon.vertices.length < 3) {
    return;
  }
  polygon.vertices.map((vertex) => worldToScreen(vertex, view)).forEach((handle) => {
    drawHandle(handle);
  });
}

function transformedCoordinatesActive(): boolean {
  return state.view.coordinateMode === 'transformed' && Math.abs(state.solver.kx - state.solver.ky) > 1e-9;
}

function displayCoordinateScale(): Point {
  if (!transformedCoordinatesActive()) {
    return { x: 1, y: 1 };
  }
  const sx = Math.sqrt(state.solver.ky / state.solver.kx);
  if (!Number.isFinite(sx) || sx <= 0) {
    return { x: 1, y: 1 };
  }
  return { x: sx, y: 1 };
}

function mapPointToDisplay(point: Point): Point {
  const scale = displayCoordinateScale();
  return {
    x: point.x * scale.x,
    y: point.y * scale.y,
  };
}

function mapPointFromDisplay(point: Point): Point {
  const scale = displayCoordinateScale();
  return {
    x: point.x / scale.x,
    y: point.y / scale.y,
  };
}

function mapBoundsToDisplay(bounds: ViewBounds): ViewBounds {
  const scale = displayCoordinateScale();
  return {
    xMin: bounds.xMin * scale.x,
    yMin: bounds.yMin * scale.y,
    width: bounds.width * scale.x,
    height: bounds.height * scale.y,
  };
}

function getViewport(): Viewport {
  const rect = canvas.getBoundingClientRect();
  const pad = 14;
  const maxW = Math.max(10, rect.width - 2 * pad);
  const maxH = Math.max(10, rect.height - 2 * pad);
  const displayDomain = mapPointToDisplay({ x: state.domain.width, y: state.domain.height });
  const domainAspect = displayDomain.x / Math.max(displayDomain.y, 1e-9);
  const screenAspect = maxW / maxH;

  let width = maxW;
  let height = maxH;
  if (screenAspect > domainAspect) {
    height = maxH;
    width = height * domainAspect;
  } else {
    width = maxW;
    height = width / domainAspect;
  }

  const left = 0.5 * (rect.width - width);
  const top = 0.5 * (rect.height - height);
  return { left, top, width, height };
}

function getCanvasView(): CanvasView {
  const viewport = getViewport();
  return {
    viewport,
    bounds: getViewBounds(),
  };
}

function getViewBounds(zoom = state.camera.zoom, center = state.camera.center): ViewBounds {
  const safeZoom = clamp(zoom, state.camera.minZoom, state.camera.maxZoom);
  const width = state.domain.width / safeZoom;
  const height = state.domain.height / safeZoom;
  const clampedCenter = clampCameraCenter(center, safeZoom);

  return {
    xMin: clampedCenter.x - 0.5 * width,
    yMin: clampedCenter.y - 0.5 * height,
    width,
    height,
  };
}

function resolveView(viewOrViewport: CanvasView | Viewport): CanvasView {
  if ('bounds' in viewOrViewport) {
    return viewOrViewport;
  }
  return {
    viewport: viewOrViewport,
    bounds: getViewBounds(),
  };
}

function worldToScreen(point: Point, viewOrViewport: CanvasView | Viewport): Point {
  const view = resolveView(viewOrViewport);
  const displayBounds = mapBoundsToDisplay(view.bounds);
  const displayPoint = mapPointToDisplay(point);
  return {
    x:
      view.viewport.left +
      ((displayPoint.x - displayBounds.xMin) / Math.max(displayBounds.width, 1e-9)) * view.viewport.width,
    y:
      view.viewport.top +
      (1 - (displayPoint.y - displayBounds.yMin) / Math.max(displayBounds.height, 1e-9)) * view.viewport.height,
  };
}

function screenToWorld(point: Point, viewOrViewport: CanvasView | Viewport): Point {
  const view = resolveView(viewOrViewport);
  const displayBounds = mapBoundsToDisplay(view.bounds);
  const displayPoint = {
    x: displayBounds.xMin + ((point.x - view.viewport.left) / view.viewport.width) * displayBounds.width,
    y: displayBounds.yMin + (1 - (point.y - view.viewport.top) / view.viewport.height) * displayBounds.height,
  };
  return mapPointFromDisplay(displayPoint);
}

function headColor(head: number, minHead: number, maxHead: number): string {
  const t = clamp((head - minHead) / Math.max(maxHead - minHead, 1e-9), 0, 1);
  const hue = 208 - 175 * t;
  const sat = 72 - 12 * t;
  const light = 47 + 9 * t;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function exportCanvasPng(): void {
  const link = document.createElement('a');
  link.download = `flownet-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function exportStateJson(): void {
  const snapshot: PersistedFlowNetStateV1 = {
    schema: 'flownet2-state',
    version: 1,
    savedAt: new Date().toISOString(),
    domain: { ...state.domain },
    solver: { ...state.solver },
    view: { ...state.view },
    newHead: readNumber(newHeadInput, 8, -200, 200),
    lineBoundaries: state.lineBoundaries.map((line) => ({
      id: line.id,
      kind: line.kind,
      vertices: getLineVertices(line).map((vertex) => ({ ...vertex })),
      head: line.head,
    })),
    polygons: state.polygons.map((polygon) => ({
      id: polygon.id,
      vertices: polygon.vertices.map((vertex) => ({ ...vertex })),
    })),
    standpipePoint: state.standpipePoint ? { ...state.standpipePoint } : null,
  };

  const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = `flownet-state-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importStateFromFile(file: File): Promise<void> {
  try {
    const text = await file.text();
    const parsed = parsePersistedState(JSON.parse(text));
    applyPersistedState(parsed, file.name);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    statusText.textContent = `Load failed: ${message}`;
  }
}

function parsePersistedState(raw: unknown): PersistedFlowNetStateV1 {
  const root = asRecord(raw, 'State file');
  const version = readInteger(root.version, 'version', 1, 1_000);
  const schema = root.schema;
  if (schema !== 'flownet2-state') {
    throw new Error('Unsupported file schema.');
  }
  if (version !== 1) {
    throw new Error(`Unsupported state version: ${version}.`);
  }

  const domainRecord = asRecord(root.domain, 'domain');
  const solverRecord = asRecord(root.solver, 'solver');
  const viewRecord = asRecord(root.view, 'view');

  const domain: DomainSettings = {
    width: readNumberValue(domainRecord.width, 'domain.width', 5, 120),
    height: readNumberValue(domainRecord.height, 'domain.height', 3, 60),
  };

  const solver: SolverSettings = {
    nx: toOddInteger(readInteger(solverRecord.nx, 'solver.nx', 11, 201)),
    ny: toOddInteger(readInteger(solverRecord.ny, 'solver.ny', 11, 201)),
    kx: readNumberValue(solverRecord.kx, 'solver.kx', 0.01, 1000),
    ky: readNumberValue(solverRecord.ky, 'solver.ky', 0.01, 1000),
    maxIter: readInteger(solverRecord.maxIter, 'solver.maxIter', 200, 50000),
    tolerance: readNumberValue(solverRecord.tolerance, 'solver.tolerance', 1e-7, 0.1),
    omega: readNumberValue(solverRecord.omega, 'solver.omega', 1, 1.95),
  };

  const coordinateModeRaw = viewRecord.coordinateMode;
  const coordinateMode: CoordinateMode =
    coordinateModeRaw === 'transformed' || coordinateModeRaw === 'real' ? coordinateModeRaw : 'real';
  const view: ViewSettings = {
    contours: readInteger(viewRecord.contours, 'view.contours', 3, 30),
    streamlines: readInteger(viewRecord.streamlines, 'view.streamlines', 4, 36),
    autoSolve: readBoolean(viewRecord.autoSolve, 'view.autoSolve'),
    coordinateMode,
    showHeadMap: readOptionalBoolean(viewRecord.showHeadMap, false, 'view.showHeadMap'),
  };

  const newHead = readNumberValue(root.newHead, 'newHead', -200, 200);
  const lineBoundaries = readLineBoundaries(root.lineBoundaries);
  const polygons = readPolygons(root.polygons);
  const standpipePoint = readOptionalPoint(root.standpipePoint, 'standpipePoint');

  return {
    schema: 'flownet2-state',
    version: 1,
    savedAt: typeof root.savedAt === 'string' ? root.savedAt : new Date().toISOString(),
    domain,
    solver,
    view,
    newHead,
    lineBoundaries,
    polygons,
    standpipePoint,
  };
}

function applyPersistedState(imported: PersistedFlowNetStateV1, fileName: string): void {
  state.domain = { ...imported.domain };
  state.solver = { ...imported.solver };
  state.view = { ...imported.view };
  state.pendingLineStart = null;
  state.previewPoint = null;
  state.selected = null;
  state.drag = { type: 'none' };
  state.solution = null;
  state.standpipeReading = null;
  state.standpipePoint = imported.standpipePoint ? clampPoint(imported.standpipePoint) : null;
  state.camera.zoom = 1;
  state.camera.center = { x: 0.5 * state.domain.width, y: 0.5 * state.domain.height };
  state.camera.panMode = false;

  state.lineBoundaries = imported.lineBoundaries.map((line) => ({
    id: line.id,
    kind: line.kind,
    vertices: normalizeLineVertices(line.vertices.map((vertex) => clampPoint(vertex))),
    head: line.head,
  }));
  state.polygons = imported.polygons.map((polygon) => ({
    id: polygon.id,
    vertices: polygon.vertices.map((vertex) => clampPoint(vertex)),
  }));

  const maxBoundaryId = state.lineBoundaries.reduce((maxId, line) => Math.max(maxId, line.id), 0);
  const maxPolygonId = state.polygons.reduce((maxId, polygon) => Math.max(maxId, polygon.id), 0);
  state.nextId = Math.max(maxBoundaryId, maxPolygonId) + 1;

  domainWidthInput.value = String(state.domain.width);
  domainHeightInput.value = String(state.domain.height);
  gridNxInput.value = String(state.solver.nx);
  gridNyInput.value = String(state.solver.ny);
  kxInput.value = String(state.solver.kx);
  kyInput.value = String(state.solver.ky);
  maxIterInput.value = String(state.solver.maxIter);
  toleranceInput.value = String(state.solver.tolerance);
  omegaInput.value = String(state.solver.omega);
  contoursInput.value = String(state.view.contours);
  streamlinesInput.value = String(state.view.streamlines);
  coordModeSelect.value = state.view.coordinateMode;
  showHeadMapInput.checked = state.view.showHeadMap;
  autoSolveInput.checked = state.view.autoSolve;
  newHeadInput.value = String(imported.newHead);

  clearExampleInUrl();
  exampleSummary.textContent = `Loaded from file: ${fileName}`;

  setTool('select');
  updateSelectionPanel();
  solveAndRender();
}

function clearExampleInUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('example')) {
    return;
  }
  url.searchParams.delete('example');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function readLineBoundaries(value: unknown): LineBoundary[] {
  if (!Array.isArray(value)) {
    throw new Error('lineBoundaries must be an array.');
  }
  return value.map((entry, index) => {
    const record = asRecord(entry, `lineBoundaries[${index}]`);
    const kind = readLineKind(record.kind, `lineBoundaries[${index}].kind`);
    if (!Array.isArray(record.vertices) || record.vertices.length < 2) {
      throw new Error(`lineBoundaries[${index}].vertices must contain at least 2 points.`);
    }
    const vertices = record.vertices.map((vertex, vertexIndex) =>
      readPoint(vertex, `lineBoundaries[${index}].vertices[${vertexIndex}]`),
    );
    const id = readInteger(record.id, `lineBoundaries[${index}].id`, 1, 1_000_000);
    const head = kind === 'equipotential'
      ? readNumberValue(record.head, `lineBoundaries[${index}].head`, -200, 200)
      : 0;
    return { id, kind, vertices, head };
  });
}

function readPolygons(value: unknown): NoFlowPolygon[] {
  if (!Array.isArray(value)) {
    throw new Error('polygons must be an array.');
  }
  return value.map((entry, index) => {
    const record = asRecord(entry, `polygons[${index}]`);
    const id = readInteger(record.id, `polygons[${index}].id`, 1, 1_000_000);
    if (!Array.isArray(record.vertices) || record.vertices.length < 3) {
      throw new Error(`polygons[${index}].vertices must contain at least 3 points.`);
    }
    const vertices = record.vertices.map((vertex, vertexIndex) =>
      readPoint(vertex, `polygons[${index}].vertices[${vertexIndex}]`),
    );
    return { id, vertices };
  });
}

function readOptionalPoint(value: unknown, label: string): Point | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  return readPoint(value, label);
}

function readPoint(value: unknown, label: string): Point {
  const record = asRecord(value, label);
  return {
    x: readNumberValue(record.x, `${label}.x`, -1e6, 1e6),
    y: readNumberValue(record.y, `${label}.y`, -1e6, 1e6),
  };
}

function readLineKind(value: unknown, label: string): LineKind {
  if (value === 'equipotential' || value === 'phreatic' || value === 'noflow') {
    return value;
  }
  throw new Error(`${label} must be equipotential, phreatic, or noflow.`);
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be true/false.`);
  }
  return value;
}

function readOptionalBoolean(value: unknown, fallback: boolean, label: string): boolean {
  if (typeof value === 'undefined') {
    return fallback;
  }
  return readBoolean(value, label);
}

function readInteger(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number.`);
  }
  return clamp(Math.round(value), min, max);
}

function readNumberValue(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return clamp(value, min, max);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function projectPointToSegment(point: Point, a: Point, b: Point): Point {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const lenSq = ab.x * ab.x + ab.y * ab.y;
  if (lenSq <= 1e-12) {
    return { ...a };
  }
  const t = clamp(((point.x - a.x) * ab.x + (point.y - a.y) * ab.y) / lenSq, 0, 1);
  return {
    x: a.x + t * ab.x,
    y: a.y + t * ab.y,
  };
}

function distancePointToSegment(point: Point, a: Point, b: Point): number {
  const projection = projectPointToSegment(point, a, b);
  return distance(point, projection);
}

function projectPointToPolyline(point: Point, vertices: Point[]): Point {
  if (vertices.length < 2) {
    return vertices[0] ? { ...vertices[0] } : { ...point };
  }
  let best = projectPointToSegment(point, vertices[0], vertices[1]);
  let bestDist = distance(point, best);
  for (let i = 1; i < vertices.length - 1; i += 1) {
    const candidate = projectPointToSegment(point, vertices[i], vertices[i + 1]);
    const dist = distance(point, candidate);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

function samplePointOnPolyline(vertices: Point[], t: number): Point {
  if (vertices.length === 0) {
    return { x: 0, y: 0 };
  }
  if (vertices.length === 1) {
    return { ...vertices[0] };
  }
  const clampedT = clamp(t, 0, 1);
  const lengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < vertices.length - 1; i += 1) {
    const segmentLength = distance(vertices[i], vertices[i + 1]);
    lengths.push(segmentLength);
    totalLength += segmentLength;
  }
  if (totalLength < 1e-9) {
    return { ...vertices[0] };
  }
  let target = clampedT * totalLength;
  for (let i = 0; i < lengths.length; i += 1) {
    const segLength = lengths[i];
    if (target <= segLength || i === lengths.length - 1) {
      const localT = segLength < 1e-9 ? 0 : target / segLength;
      return {
        x: vertices[i].x + (vertices[i + 1].x - vertices[i].x) * localT,
        y: vertices[i].y + (vertices[i + 1].y - vertices[i].y) * localT,
      };
    }
    target -= segLength;
  }
  return { ...vertices[vertices.length - 1] };
}

function rasterizeBoundaryLineNodes(
  line: LineBoundary,
  domain: DomainSettings,
  solver: SolverSettings,
  paddingCells: number,
): Array<{ i: number; j: number }> {
  const vertices = getLineVertices(line);
  if (vertices.length < 2) {
    return [];
  }
  const nodes: Array<{ i: number; j: number }> = [];
  const visited = new Set<string>();

  for (let i = 0; i < vertices.length - 1; i += 1) {
    const a = vertices[i];
    const b = vertices[i + 1];
    rasterizeLineNodes(a, b, domain, solver, paddingCells).forEach((node) => {
      const key = `${node.i},${node.j}`;
      if (visited.has(key)) {
        return;
      }
      visited.add(key);
      nodes.push(node);
    });
  }

  return nodes;
}

function buildModifierCursor(kind: 'plus' | 'minus'): string {
  const markPath = kind === 'plus' ? 'M12 7v10M7 12h10' : 'M7 12h10';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
    `<circle cx="12" cy="12" r="8.4" fill="white" fill-opacity="0.9" stroke="#1e293b" stroke-width="1.2"/>` +
    `<path d="${markPath}" stroke="#0f766e" stroke-width="1.8" stroke-linecap="round"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`;
}

function pointInPolygon(point: Point, vertices: Point[]): boolean {
  if (vertices.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const vi = vertices[i];
    const vj = vertices[j];
    const intersect =
      (vi.y > point.y) !== (vj.y > point.y) &&
      point.x < ((vj.x - vi.x) * (point.y - vi.y)) / (vj.y - vi.y + 1e-12) + vi.x;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function distancePointToPolygonEdges(point: Point, vertices: Point[]): number {
  if (vertices.length < 2) {
    return Number.POSITIVE_INFINITY;
  }
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    best = Math.min(best, distancePointToSegment(point, a, b));
  }
  return best;
}

function rasterizeLineNodes(
  a: Point,
  b: Point,
  domain: DomainSettings,
  solver: SolverSettings,
  paddingCells: number,
): Array<{ i: number; j: number }> {
  const dx = domain.width / (solver.nx - 1);
  const dy = domain.height / (solver.ny - 1);

  const toGridNode = (point: Point): { i: number; j: number } => ({
    i: clamp(Math.round(point.x / dx), 0, solver.nx - 1),
    j: clamp(Math.round(point.y / dy), 0, solver.ny - 1),
  });

  const spanI = Math.abs((b.x - a.x) / dx);
  const spanJ = Math.abs((b.y - a.y) / dy);
  const segments = Math.max(1, Math.ceil(4 * Math.max(spanI, spanJ)));

  const nodes: Array<{ i: number; j: number }> = [];
  const visited = new Set<string>();

  const addNode = (i: number, j: number): void => {
    if (i < 0 || i >= solver.nx || j < 0 || j >= solver.ny) {
      return;
    }
    const key = `${i},${j}`;
    if (visited.has(key)) {
      return;
    }
    visited.add(key);
    nodes.push({ i, j });
  };

  const addWithPadding = (i: number, j: number): void => {
    if (paddingCells <= 0) {
      addNode(i, j);
      return;
    }
    for (let dj = -paddingCells; dj <= paddingCells; dj += 1) {
      for (let di = -paddingCells; di <= paddingCells; di += 1) {
        if (di * di + dj * dj > paddingCells * paddingCells) {
          continue;
        }
        addNode(i + di, j + dj);
      }
    }
  };

  let previous = toGridNode(a);
  addWithPadding(previous.i, previous.j);

  for (let step = 1; step <= segments; step += 1) {
    const t = step / segments;
    const sample = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
    const current = toGridNode(sample);
    supercoverGridLine(previous.i, previous.j, current.i, current.j).forEach((node) => {
      addWithPadding(node.i, node.j);
    });
    previous = current;
  }

  return nodes;
}

function supercoverGridLine(
  i0: number,
  j0: number,
  i1: number,
  j1: number,
): Array<{ i: number; j: number }> {
  const nodes: Array<{ i: number; j: number }> = [];
  const deltaI = i1 - i0;
  const deltaJ = j1 - j0;
  const stepsI = Math.abs(deltaI);
  const stepsJ = Math.abs(deltaJ);
  const stepI = Math.sign(deltaI);
  const stepJ = Math.sign(deltaJ);

  let i = i0;
  let j = j0;
  let walkedI = 0;
  let walkedJ = 0;

  nodes.push({ i, j });

  while (walkedI < stepsI || walkedJ < stepsJ) {
    const ratioI = stepsI === 0 ? Number.POSITIVE_INFINITY : (0.5 + walkedI) / stepsI;
    const ratioJ = stepsJ === 0 ? Number.POSITIVE_INFINITY : (0.5 + walkedJ) / stepsJ;

    if (Math.abs(ratioI - ratioJ) < 1e-12) {
      i += stepI;
      j += stepJ;
      if (stepsI > 0) {
        walkedI += 1;
      }
      if (stepsJ > 0) {
        walkedJ += 1;
      }
      if (stepI !== 0) {
        nodes.push({ i, j: j - stepJ });
      }
      if (stepJ !== 0) {
        nodes.push({ i: i - stepI, j });
      }
      nodes.push({ i, j });
      continue;
    }

    if (ratioI < ratioJ) {
      i += stepI;
      walkedI += 1;
    } else {
      j += stepJ;
      walkedJ += 1;
    }
    nodes.push({ i, j });
  }

  return nodes;
}

function normalize(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 1e-12) {
    return { x: 0, y: 0 };
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

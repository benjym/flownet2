import './style.css';

type Tool = 'select' | 'equipotential' | 'phreatic' | 'noflow-line' | 'noflow-zone' | 'standpipe';
type LineKind = 'equipotential' | 'phreatic' | 'noflow';

interface Point {
  x: number;
  y: number;
}

interface LineBoundary {
  id: number;
  kind: LineKind;
  p1: Point;
  p2: Point;
  head: number;
}

interface NoFlowZone {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
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
  p1: Point;
  p2: Point;
  head?: number;
}

interface PresetZone {
  x: number;
  y: number;
  width: number;
  height: number;
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
  zones?: PresetZone[];
  standpipePoint?: Point;
}

type Selected = { kind: 'line'; id: number } | { kind: 'zone'; id: number } | null;

type DragState =
  | { type: 'none' }
  | { type: 'line-end'; id: number; endpoint: 'p1' | 'p2' }
  | { type: 'line-move'; id: number; startPointer: Point; startP1: Point; startP2: Point }
  | { type: 'pan'; startScreen: Point; startCenter: Point }
  | {
      type: 'zone-move';
      id: number;
      startPointer: Point;
      startRect: { x: number; y: number; width: number; height: number };
    }
  | { type: 'zone-draw'; start: Point; current: Point };

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

const EXAMPLE_PRESETS: ExamplePreset[] = [
  {
    id: 'uniform-ep',
    label: 'Uniform EP Gradient (Baseline)',
    summary: 'Two equipotential boundaries produce near-parallel flow through homogeneous soil.',
    domain: { width: 30, height: 12 },
    solver: { nx: 81, ny: 41, kx: 1, ky: 1, maxIter: 4000, tolerance: 1e-4, omega: 1.6 },
    view: { contours: 14, streamlines: 12, autoSolve: true },
    newHead: 8,
    lines: [
      { kind: 'equipotential', p1: { x: 0, y: 0 }, p2: { x: 0, y: 12 }, head: 10 },
      { kind: 'equipotential', p1: { x: 30, y: 0 }, p2: { x: 30, y: 12 }, head: 2 },
    ],
  },
  {
    id: 'earth-dam',
    label: 'Flow Through Earth Dam',
    summary: 'Upstream and downstream heads with a user-defined phreatic surface and a central low-perm core.',
    domain: { width: 45, height: 16 },
    solver: { nx: 101, ny: 51, kx: 1, ky: 1, maxIter: 5000, tolerance: 1e-4, omega: 1.6 },
    view: { contours: 16, streamlines: 14, autoSolve: true },
    newHead: 10,
    lines: [
      { kind: 'equipotential', p1: { x: 0, y: 0 }, p2: { x: 0, y: 16 }, head: 13 },
      { kind: 'equipotential', p1: { x: 45, y: 0 }, p2: { x: 45, y: 16 }, head: 3 },
      { kind: 'phreatic', p1: { x: 4, y: 13.8 }, p2: { x: 36, y: 9.6 } },
      { kind: 'noflow', p1: { x: 22.5, y: 0 }, p2: { x: 22.5, y: 8.2 } },
    ],
    standpipePoint: { x: 28, y: 7.4 },
  },
  {
    id: 'cutoff-wall',
    label: 'Flow Under Cutoff Wall',
    summary: 'Vertical impermeable cutoff wall forces seepage to dive deeper below the wall tip.',
    domain: { width: 38, height: 12 },
    solver: { nx: 101, ny: 41, kx: 1, ky: 1, maxIter: 5000, tolerance: 1e-4, omega: 1.65 },
    view: { contours: 16, streamlines: 14, autoSolve: true },
    newHead: 9,
    lines: [
      { kind: 'equipotential', p1: { x: 0, y: 0 }, p2: { x: 0, y: 12 }, head: 10 },
      { kind: 'equipotential', p1: { x: 38, y: 0 }, p2: { x: 38, y: 12 }, head: 3 },
      { kind: 'noflow', p1: { x: 18.5, y: 0 }, p2: { x: 18.5, y: 8.8 } },
    ],
    standpipePoint: { x: 22.8, y: 5.2 },
  },
  {
    id: 'drain',
    label: 'Flow Into Drain',
    summary: 'Regional gradient with a short low-head drain line that attracts converging flow.',
    domain: { width: 32, height: 12 },
    solver: { nx: 91, ny: 41, kx: 1, ky: 1, maxIter: 5000, tolerance: 1e-4, omega: 1.6 },
    view: { contours: 15, streamlines: 16, autoSolve: true },
    newHead: 8,
    lines: [
      { kind: 'equipotential', p1: { x: 0, y: 0 }, p2: { x: 0, y: 12 }, head: 9.5 },
      { kind: 'equipotential', p1: { x: 32, y: 0 }, p2: { x: 32, y: 12 }, head: 6.2 },
      { kind: 'equipotential', p1: { x: 14.2, y: 0.7 }, p2: { x: 17.8, y: 0.7 }, head: 1.8 },
    ],
    standpipePoint: { x: 15.8, y: 4.6 },
  },
  {
    id: 'sheet-pile',
    label: 'Seepage Beneath Sheet Pile',
    summary: 'Top-down sheet pile interrupts shallow flow and bends equipotentials beneath the pile tip.',
    domain: { width: 40, height: 12 },
    solver: { nx: 101, ny: 41, kx: 1, ky: 1, maxIter: 5200, tolerance: 1e-4, omega: 1.65 },
    view: { contours: 16, streamlines: 14, autoSolve: true },
    newHead: 9,
    lines: [
      { kind: 'equipotential', p1: { x: 0, y: 0 }, p2: { x: 0, y: 12 }, head: 10.5 },
      { kind: 'equipotential', p1: { x: 40, y: 0 }, p2: { x: 40, y: 12 }, head: 3 },
      { kind: 'noflow', p1: { x: 20, y: 12 }, p2: { x: 20, y: 5.3 } },
    ],
    standpipePoint: { x: 24, y: 5.4 },
  },
  {
    id: 'anisotropic-demo',
    label: 'Anisotropic Classroom Demo',
    summary: 'Same boundary heads with Kx > Ky to illustrate non-orthogonal EP/flow-line behavior.',
    domain: { width: 30, height: 12 },
    solver: { nx: 81, ny: 41, kx: 4, ky: 1, maxIter: 4500, tolerance: 1e-4, omega: 1.6 },
    view: { contours: 14, streamlines: 12, autoSolve: true },
    newHead: 8,
    lines: [
      { kind: 'equipotential', p1: { x: 0, y: 0 }, p2: { x: 0, y: 12 }, head: 10 },
      { kind: 'equipotential', p1: { x: 30, y: 0 }, p2: { x: 30, y: 12 }, head: 2 },
    ],
    standpipePoint: { x: 15, y: 6 },
  },
];

const appEl = document.querySelector<HTMLDivElement>('#app');
if (!appEl) {
  throw new Error('Missing #app container');
}

appEl.innerHTML = `
  <div class="layout">
    <aside class="panel">
      <h1>Flow Net Studio</h1>
      <p class="subhead">2D anisotropic groundwater flow for first-time undergrad soil mechanics.</p>

      <section class="group">
        <h2>Quick Start</h2>
        <ol class="quick-start">
          <li>Use default EP boundaries or draw your own BCs.</li>
          <li>Press <strong>Solve now</strong> (or keep Auto-solve on).</li>
          <li>Switch to <strong>Standpipe</strong> and click to read water rise.</li>
        </ol>
      </section>

      <section class="group">
        <h2>Examples</h2>
        <label>Preset case
          <select id="exampleSelect"></select>
        </label>
        <div class="action-row">
          <button id="loadExampleBtn" type="button">Load example</button>
          <button id="copyExampleLinkBtn" type="button">Copy URL</button>
        </div>
        <p id="exampleSummary" class="hint"></p>
        <p id="exampleUrlHint" class="hint"></p>
      </section>

      <section class="group">
        <h2>Domain + Material</h2>
        <div class="grid two-col">
          <label>Width (m)<input id="domainWidth" type="number" min="5" step="1" value="30"></label>
          <label>Height (m)<input id="domainHeight" type="number" min="3" step="1" value="12"></label>
          <label>Grid Nx<input id="gridNx" type="number" min="11" max="201" step="2" value="81"></label>
          <label>Grid Ny<input id="gridNy" type="number" min="11" max="201" step="2" value="41"></label>
          <label>Kx<input id="kx" type="number" min="0.01" step="0.1" value="1"></label>
          <label>Ky<input id="ky" type="number" min="0.01" step="0.1" value="1"></label>
        </div>
      </section>

      <section class="group">
        <h2>Drawing Tools</h2>
        <div class="tool-row" id="toolRow">
          <button data-tool="select" class="is-active">Select</button>
          <button data-tool="equipotential">EP line</button>
          <button data-tool="phreatic">Phreatic</button>
          <button data-tool="noflow-line">No-flow line</button>
          <button data-tool="noflow-zone">No-flow zone</button>
          <button data-tool="standpipe">Standpipe</button>
        </div>
        <label>New EP head (m)<input id="newHead" type="number" step="0.1" value="8"></label>
        <p id="toolHint" class="hint">Select and drag endpoints/lines/zones to edit geometry and BCs.</p>
        <p id="toolStep" class="hint step-hint"></p>
      </section>

      <section class="group">
        <h2>Solver + Display</h2>
        <div class="grid two-col">
          <label>Max iterations<input id="maxIter" type="number" min="200" step="200" value="4000"></label>
          <label>Tolerance<input id="tolerance" type="number" min="0.000001" step="0.00001" value="0.0001"></label>
          <label>SOR omega<input id="omega" type="number" min="1" max="1.95" step="0.05" value="1.6"></label>
          <label>Contours<input id="contours" type="number" min="3" max="30" step="1" value="14"></label>
          <label>Flow lines<input id="streamlines" type="number" min="4" max="36" step="1" value="12"></label>
          <label class="inline-check"><input id="autoSolve" type="checkbox" checked>Auto-solve</label>
        </div>
        <div class="action-row">
          <button id="solveBtn">Solve now</button>
          <button id="resetBtn">Reset example</button>
          <button id="exportBtn">Download PNG</button>
          <button id="deleteBtn" class="danger">Delete selected</button>
        </div>
        <p id="statusText" class="status">Waiting for first solve.</p>
      </section>

      <section class="group" id="selectionBlock">
        <h2>Selected Item</h2>
        <p id="selectionType">Nothing selected.</p>
        <label id="selectedHeadRow" class="is-hidden">EP head (m)<input id="selectedHead" type="number" step="0.1" value="8"></label>
      </section>

      <section class="group">
        <h2>Boundary List</h2>
        <p id="inventorySummary" class="inventory-summary"></p>
        <div id="inventoryList" class="inventory-list"></div>
      </section>

      <section class="group">
        <h2>Standpipe</h2>
        <p id="standpipeText">Choose the standpipe tool and click inside the domain.</p>
      </section>

      <section class="group">
        <h2>Guide</h2>
        <ul>
          <li>Default outer boundary is no-flow unless you draw EP/phreatic lines.</li>
          <li>EP lines impose fixed hydraulic head.</li>
          <li>Phreatic line is a user-drawn fixed head equal to elevation.</li>
          <li>No-flow lines and zones act as impermeable boundaries.</li>
          <li>Canvas controls: <strong>+</strong>/<strong>-</strong> zoom, <strong>Pan</strong> drag, <strong>Fit</strong> reset view.</li>
          <li>Keyboard: <strong>Esc</strong> cancels drawing, <strong>Delete</strong> removes selected item.</li>
        </ul>
      </section>
    </aside>

    <main class="canvas-wrap">
      <div class="canvas-toolbar">
        <p id="canvasPrompt">Select a tool, draw boundaries, then solve and probe with the standpipe.</p>
        <div class="view-controls">
          <button id="zoomOutBtn" type="button" aria-label="Zoom out">-</button>
          <button id="zoomInBtn" type="button" aria-label="Zoom in">+</button>
          <button id="fitViewBtn" type="button">Fit</button>
          <button id="panModeBtn" type="button">Pan: Off</button>
          <span id="zoomLabel" class="zoom-label">100%</span>
        </div>
      </div>
      <canvas id="flowCanvas"></canvas>
    </main>
  </div>
`;

const canvas = byId<HTMLCanvasElement>('flowCanvas');
const ctx = getContext2D(canvas);

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
const autoSolveInput = byId<HTMLInputElement>('autoSolve');
const statusText = byId<HTMLParagraphElement>('statusText');
const standpipeText = byId<HTMLParagraphElement>('standpipeText');
const selectionType = byId<HTMLParagraphElement>('selectionType');
const selectedHeadRow = byId<HTMLLabelElement>('selectedHeadRow');
const selectedHeadInput = byId<HTMLInputElement>('selectedHead');
const toolHint = byId<HTMLParagraphElement>('toolHint');
const toolStep = byId<HTMLParagraphElement>('toolStep');
const solveBtn = byId<HTMLButtonElement>('solveBtn');
const resetBtn = byId<HTMLButtonElement>('resetBtn');
const exportBtn = byId<HTMLButtonElement>('exportBtn');
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
const exampleSelect = byId<HTMLSelectElement>('exampleSelect');
const loadExampleBtn = byId<HTMLButtonElement>('loadExampleBtn');
const copyExampleLinkBtn = byId<HTMLButtonElement>('copyExampleLinkBtn');
const exampleSummary = byId<HTMLParagraphElement>('exampleSummary');
const exampleUrlHint = byId<HTMLParagraphElement>('exampleUrlHint');

const toolButtons = Array.from(toolRow.querySelectorAll<HTMLButtonElement>('button[data-tool]'));

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
  } as ViewSettings,
  tool: 'select' as Tool,
  pendingLineStart: null as Point | null,
  previewPoint: null as Point | null,
  lineBoundaries: [] as LineBoundary[],
  zones: [] as NoFlowZone[],
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
  solution: null as Solution | null,
};

let solveTimer: number | null = null;

wireControls();
initExamplePicker();
const initialExampleId = getRequestedExampleFromUrl() ?? DEFAULT_EXAMPLE_ID;
loadExampleById(initialExampleId, { updateUrl: false, solve: false });
resizeCanvas();
solveAndRender();
window.addEventListener('resize', () => {
  resizeCanvas();
  render();
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

function initExamplePicker(): void {
  exampleSelect.innerHTML = '';
  EXAMPLE_PRESETS.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label;
    exampleSelect.appendChild(option);
  });

  exampleSelect.addEventListener('change', () => {
    updateExampleSummary();
  });

  loadExampleBtn.addEventListener('click', () => {
    loadExampleById(exampleSelect.value);
  });

  copyExampleLinkBtn.addEventListener('click', async () => {
    const url = buildExampleUrl(exampleSelect.value);
    try {
      await navigator.clipboard.writeText(url);
      exampleSummary.textContent = `${currentExampleSummary()} Link copied: ${url}`;
    } catch {
      exampleSummary.textContent = `${currentExampleSummary()} Copy failed. Use: ${url}`;
    }
  });

  updateExampleSummary();
}

function getRequestedExampleFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('example');
  if (!requested) {
    return null;
  }
  return EXAMPLE_PRESETS.some((preset) => preset.id === requested) ? requested : null;
}

function loadExampleById(
  presetId: string,
  options?: { updateUrl?: boolean; solve?: boolean },
): void {
  const preset = EXAMPLE_PRESETS.find((item) => item.id === presetId);
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
  state.camera.zoom = 1;
  state.camera.center = { x: 0.5 * state.domain.width, y: 0.5 * state.domain.height };
  state.camera.panMode = false;
  state.lineBoundaries = [];
  state.zones = [];
  state.nextId = 1;

  preset.lines.forEach((line) => {
    addBoundary(line.kind, line.p1, line.p2, line.head ?? 0);
  });

  (preset.zones ?? []).forEach((zone) => {
    state.zones.push({
      id: state.nextId++,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
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

function buildExampleUrl(presetId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('example', presetId);
  return url.toString();
}

function currentExampleSummary(): string {
  const preset = EXAMPLE_PRESETS.find((item) => item.id === exampleSelect.value);
  return preset ? `${preset.label}: ${preset.summary}` : '';
}

function updateExampleSummary(): void {
  const preset = EXAMPLE_PRESETS.find((item) => item.id === exampleSelect.value);
  if (!preset) {
    exampleSummary.textContent = '';
    exampleUrlHint.innerHTML = '';
    return;
  }
  exampleSummary.textContent = `${preset.label}: ${preset.summary}`;
  exampleUrlHint.innerHTML = `URL parameter: <code>?example=${preset.id}</code>`;
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

  resetBtn.addEventListener('click', () => {
    resetExample();
  });

  exportBtn.addEventListener('click', () => {
    exportCanvasPng();
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
  });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
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
      line.p1.x *= widthScale;
      line.p2.x *= widthScale;
      line.p1.y *= heightScale;
      line.p2.y *= heightScale;
      line.p1 = clampPoint(line.p1);
      line.p2 = clampPoint(line.p2);
    });

    state.zones.forEach((zone) => {
      zone.x *= widthScale;
      zone.y *= heightScale;
      zone.width *= widthScale;
      zone.height *= heightScale;
      normalizeZone(zone);
      clampZone(zone);
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
  if (event.key === 'Escape') {
    const hadPendingDraw =
      state.pendingLineStart !== null ||
      state.drag.type === 'zone-draw' ||
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
    return;
  }

  if ((event.key === 'Delete' || event.key === 'Backspace') && !isTypingTarget(event.target)) {
    event.preventDefault();
    deleteSelected();
  }
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
    state.zones = state.zones.filter((zone) => zone.id !== state.selected?.id);
  }
  state.selected = null;
  updateSelectionPanel();
  scheduleSolve();
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
}

function resetExample(): void {
  loadExampleById(DEFAULT_EXAMPLE_ID);
}

function addBoundary(kind: LineKind, p1: Point, p2: Point, head: number): void {
  state.lineBoundaries.push({
    id: state.nextId,
    kind,
    p1: clampPoint({ ...p1 }),
    p2: clampPoint({ ...p2 }),
    head,
  });
  state.nextId += 1;
}

function onPointerDown(event: PointerEvent): void {
  const view = getCanvasView();
  const screenPoint = eventToCanvasPoint(event);
  if (!pointInViewport(screenPoint, view.viewport)) {
    return;
  }
  const point = clampPoint(screenToWorld(screenPoint, view));
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
    return;
  }

  if (state.tool === 'select') {
    startSelectionDrag(point);
    render();
    return;
  }

  if (state.tool === 'standpipe') {
    state.standpipePoint = point;
    updateStandpipeReading();
    updateGuidanceUI();
    render();
    return;
  }

  if (state.tool === 'noflow-zone') {
    state.drag = { type: 'zone-draw', start: point, current: point };
    updateGuidanceUI();
    render();
    return;
  }

  if (state.tool === 'equipotential' || state.tool === 'phreatic' || state.tool === 'noflow-line') {
    if (!state.pendingLineStart) {
      state.pendingLineStart = point;
      state.previewPoint = point;
      updateGuidanceUI();
      render();
      return;
    }

    const start = state.pendingLineStart;
    const end = clampPoint(point);
    state.pendingLineStart = null;
    state.previewPoint = null;
    updateGuidanceUI();

    if (distance(start, end) < 0.02 * Math.min(state.domain.width, state.domain.height)) {
      render();
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
      return;
    }

    const lineHead = mapped === 'equipotential' ? readNumber(newHeadInput, 8, -200, 200) : 0;
    addBoundary(mapped, start, end, lineHead);
    state.selected = { kind: 'line', id: state.nextId - 1 };
    updateSelectionPanel();
    scheduleSolve();
    return;
  }
}

function onPointerMove(event: PointerEvent): void {
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
    updateGuidanceUI();
    render();
    return;
  }

  if (!pointInViewport(screenPoint, view.viewport)) {
    return;
  }
  const point = clampPoint(screenToWorld(screenPoint, view));
  state.lastPointerType = event.pointerType || state.lastPointerType;

  if (state.pendingLineStart) {
    state.previewPoint = point;
  }

  if (state.drag.type === 'line-end') {
    const drag = state.drag;
    const line = state.lineBoundaries.find((item) => item.id === drag.id);
    if (!line) {
      return;
    }
    line[drag.endpoint] = clampPoint(point);
    scheduleSolve();
    render();
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

    const minX = Math.min(drag.startP1.x, drag.startP2.x);
    const maxX = Math.max(drag.startP1.x, drag.startP2.x);
    const minY = Math.min(drag.startP1.y, drag.startP2.y);
    const maxY = Math.max(drag.startP1.y, drag.startP2.y);

    const dx = clamp(dxRaw, -minX, state.domain.width - maxX);
    const dy = clamp(dyRaw, -minY, state.domain.height - maxY);

    line.p1 = { x: drag.startP1.x + dx, y: drag.startP1.y + dy };
    line.p2 = { x: drag.startP2.x + dx, y: drag.startP2.y + dy };
    scheduleSolve();
    render();
    return;
  }

  if (state.drag.type === 'zone-move') {
    const drag = state.drag;
    const zone = state.zones.find((item) => item.id === drag.id);
    if (!zone) {
      return;
    }
    const dxRaw = point.x - drag.startPointer.x;
    const dyRaw = point.y - drag.startPointer.y;
    zone.x = clamp(drag.startRect.x + dxRaw, 0, state.domain.width - zone.width);
    zone.y = clamp(drag.startRect.y + dyRaw, 0, state.domain.height - zone.height);
    scheduleSolve();
    render();
    return;
  }

  if (state.drag.type === 'zone-draw') {
    state.drag.current = point;
    render();
    return;
  }

  render();
}

function onPointerUp(event: PointerEvent): void {
  const view = getCanvasView();
  const screenPoint = eventToCanvasPoint(event);
  const point = pointInViewport(screenPoint, view.viewport)
    ? clampPoint(screenToWorld(screenPoint, view))
    : null;

  if (point && state.drag.type === 'zone-draw') {
    const zone = createZoneFromDrag(state.drag.start, state.drag.current);
    if (zone) {
      state.zones.push(zone);
      state.selected = { kind: 'zone', id: zone.id };
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
}

function onPointerLeave(): void {
  if (state.drag.type === 'zone-draw') {
    return;
  }
  state.previewPoint = null;
  render();
}

function createZoneFromDrag(start: Point, end: Point): NoFlowZone | null {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  const minSide = 0.01 * Math.min(state.domain.width, state.domain.height);
  if (width < minSide || height < minSide) {
    return null;
  }
  return {
    id: state.nextId++,
    x,
    y,
    width,
    height,
  };
}

function startSelectionDrag(point: Point): void {
  const endpointHit = findLineEndpoint(point);
  if (endpointHit) {
    state.selected = { kind: 'line', id: endpointHit.id };
    state.drag = {
      type: 'line-end',
      id: endpointHit.id,
      endpoint: endpointHit.endpoint,
    };
    updateSelectionPanel();
    return;
  }

  const zoneHit = findZone(point);
  if (zoneHit) {
    state.selected = { kind: 'zone', id: zoneHit.id };
    state.drag = {
      type: 'zone-move',
      id: zoneHit.id,
      startPointer: point,
      startRect: {
        x: zoneHit.x,
        y: zoneHit.y,
        width: zoneHit.width,
        height: zoneHit.height,
      },
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
      startP1: { ...lineHit.p1 },
      startP2: { ...lineHit.p2 },
    };
    updateSelectionPanel();
    return;
  }

  state.selected = null;
  state.drag = { type: 'none' };
  updateSelectionPanel();
}

function findLineEndpoint(point: Point): { id: number; endpoint: 'p1' | 'p2' } | null {
  const threshold = pointerWorldThreshold();
  for (let index = state.lineBoundaries.length - 1; index >= 0; index -= 1) {
    const line = state.lineBoundaries[index];
    if (distance(point, line.p1) <= threshold) {
      return { id: line.id, endpoint: 'p1' };
    }
    if (distance(point, line.p2) <= threshold) {
      return { id: line.id, endpoint: 'p2' };
    }
  }
  return null;
}

function findZone(point: Point): NoFlowZone | null {
  for (let index = state.zones.length - 1; index >= 0; index -= 1) {
    const zone = state.zones[index];
    if (pointInZone(point, zone)) {
      return zone;
    }
  }
  return null;
}

function findLine(point: Point): LineBoundary | null {
  const threshold = pointerWorldThreshold();
  for (let index = state.lineBoundaries.length - 1; index >= 0; index -= 1) {
    const line = state.lineBoundaries[index];
    if (distancePointToSegment(point, line.p1, line.p2) <= threshold) {
      return line;
    }
  }
  return null;
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

function clampZone(zone: NoFlowZone): void {
  zone.width = clamp(zone.width, 0.05, state.domain.width);
  zone.height = clamp(zone.height, 0.05, state.domain.height);
  zone.x = clamp(zone.x, 0, state.domain.width - zone.width);
  zone.y = clamp(zone.y, 0, state.domain.height - zone.height);
}

function normalizeZone(zone: NoFlowZone): void {
  if (zone.width < 0) {
    zone.x += zone.width;
    zone.width *= -1;
  }
  if (zone.height < 0) {
    zone.y += zone.height;
    zone.height *= -1;
  }
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
  state.solution = solveGroundwater(state.domain, state.solver, state.view, state.lineBoundaries, state.zones);
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
    select: 'Select and drag endpoints/lines/zones to edit geometry and BCs.',
    equipotential: 'Draw a fixed-head equipotential (EP) line.',
    phreatic: 'Draw a user-defined phreatic line (head = elevation).',
    'noflow-line': 'Draw an impermeable no-flow line.',
    'noflow-zone': 'Draw an impermeable no-flow zone.',
    standpipe: 'Place standpipe points to read pressure head and rise.',
  };
  toolHint.textContent = hints[state.tool];

  let stepText = '';
  if (state.camera.panMode) {
    stepText = 'Pan mode: drag the canvas to move view. Use + / - (or wheel) to zoom, then Fit to reset.';
  } else if (state.tool === 'select') {
    stepText = 'Step: click a boundary or zone, then drag to move. Drag orange endpoints to reshape lines.';
  } else if (state.tool === 'equipotential' || state.tool === 'phreatic' || state.tool === 'noflow-line') {
    stepText = state.pendingLineStart
      ? 'Step 2 of 2: click second endpoint to finish this line. Press Esc to cancel.'
      : 'Step 1 of 2: click first endpoint for a new line.';
  } else if (state.tool === 'noflow-zone') {
    stepText = state.drag.type === 'zone-draw'
      ? 'Step 2 of 2: drag and release to set zone size. Press Esc to cancel.'
      : 'Step 1 of 2: click and drag to create a rectangular no-flow zone.';
  } else {
    stepText = 'Step 1 of 1: click inside active soil to place a standpipe.';
  }

  const bounds = getViewBounds();
  toolStep.textContent = stepText;
  canvasPrompt.textContent =
    `${stepText} | View x:${bounds.xMin.toFixed(1)}-${(bounds.xMin + bounds.width).toFixed(1)}m ` +
    `y:${bounds.yMin.toFixed(1)}-${(bounds.yMin + bounds.height).toFixed(1)}m | ` +
    `${state.lineBoundaries.length} line BCs, ${state.zones.length} no-flow zones.`;
  zoomLabel.textContent = `${Math.round(state.camera.zoom * 100)}%`;
  panModeBtn.textContent = state.camera.panMode ? 'Pan: On' : 'Pan: Off';
  panModeBtn.classList.toggle('is-active', state.camera.panMode);
}

function updateBoundaryInventory(): void {
  const lines = [...state.lineBoundaries].sort((a, b) => a.id - b.id);
  const zones = [...state.zones].sort((a, b) => a.id - b.id);

  inventorySummary.textContent = `${lines.length} line BCs + ${zones.length} no-flow zones`;
  inventoryList.innerHTML = '';

  if (lines.length === 0 && zones.length === 0) {
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

  zones.forEach((zone) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-item';
    if (state.selected?.kind === 'zone' && state.selected.id === zone.id) {
      button.classList.add('is-selected');
    }
    button.textContent = `No-flow zone #${zone.id} (${zone.width.toFixed(1)}m x ${zone.height.toFixed(1)}m)`;
    button.addEventListener('click', () => {
      state.selected = { kind: 'zone', id: zone.id };
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
    updateBoundaryInventory();
    updateGuidanceUI();
    return;
  }

  if (state.selected.kind === 'line') {
    const line = state.lineBoundaries.find((item) => item.id === state.selected?.id);
    if (!line) {
      selectionType.textContent = 'Nothing selected.';
      selectedHeadRow.classList.add('is-hidden');
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
    updateBoundaryInventory();
    updateGuidanceUI();
    return;
  }

  const zone = state.zones.find((item) => item.id === state.selected?.id);
  if (!zone) {
    selectionType.textContent = 'Nothing selected.';
    selectedHeadRow.classList.add('is-hidden');
    updateBoundaryInventory();
    updateGuidanceUI();
    return;
  }
  selectionType.textContent = `No-flow zone #${zone.id} (${zone.width.toFixed(2)}m x ${zone.height.toFixed(2)}m)`;
  selectedHeadRow.classList.add('is-hidden');
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
  zones: NoFlowZone[],
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

  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const point = { x: i * dx, y: j * dy };
      if (zones.some((zone) => pointInZone(point, zone))) {
        active[j][i] = false;
        continue;
      }
      if (noFlowLines.some((line) => distancePointToSegment(point, line.p1, line.p2) <= bandThickness)) {
        active[j][i] = false;
      }
    }
  }

  const dirichletThreshold = 0.55 * Math.min(dx, dy);
  let dirichletCount = 0;
  let fixedHeadSum = 0;

  fixedLines.forEach((line) => {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        if (!active[j][i]) {
          continue;
        }
        const point = { x: i * dx, y: j * dy };
        if (distancePointToSegment(point, line.p1, line.p2) > dirichletThreshold) {
          continue;
        }
        const projection = projectPointToSegment(point, line.p1, line.p2);
        const value = line.kind === 'equipotential' ? line.head : projection.y;
        if (!dirichlet[j][i]) {
          dirichletCount += 1;
        }
        dirichlet[j][i] = true;
        heads[j][i] = value;
      }
    }
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
      ? {
          x: seedLine.p1.x + (seedLine.p2.x - seedLine.p1.x) * t,
          y: seedLine.p1.y + (seedLine.p2.y - seedLine.p1.y) * t,
        }
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

  ctx.clearRect(0, 0, rect.width, rect.height);

  const bg = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  bg.addColorStop(0, '#f6f8f4');
  bg.addColorStop(1, '#dde7ef');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, rect.width, rect.height);

  ctx.fillStyle = '#fefcf6';
  ctx.fillRect(viewport.left, viewport.top, viewport.width, viewport.height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(viewport.left, viewport.top, viewport.width, viewport.height);
  ctx.clip();

  if (state.solution) {
    drawHeadShading(view, state.solution);
    drawContourSegments(view, state.solution);
    drawStreamPaths(view, state.solution.streamPaths);
  }

  drawZones(view);
  drawBoundaries(view);
  drawPendingShape(view);
  drawStandpipe(view);
  drawSelection(view);
  ctx.restore();

  drawDomainOutline(view);
  drawOverlayLegend(view);
}

function drawDomainOutline(view: CanvasView): void {
  const { viewport, bounds } = view;
  ctx.strokeStyle = '#213547';
  ctx.lineWidth = 2;
  ctx.strokeRect(viewport.left, viewport.top, viewport.width, viewport.height);

  ctx.fillStyle = '#102332';
  ctx.font = '12px "Trebuchet MS", "Gill Sans", sans-serif';
  const xMin = bounds.xMin.toFixed(1);
  const xMax = (bounds.xMin + bounds.width).toFixed(1);
  const yMax = (bounds.yMin + bounds.height).toFixed(1);
  ctx.fillText(xMin, viewport.left - 10, viewport.top + viewport.height + 14);
  ctx.fillText(`${xMax} m`, viewport.left + viewport.width - 38, viewport.top + viewport.height + 14);
  ctx.fillText(`${yMax} m`, viewport.left - 34, viewport.top + 10);
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

  const minLevel = solution.contourLevels[0];
  const maxLevel = solution.contourLevels[solution.contourLevels.length - 1];

  solution.contourSegments.forEach((segment) => {
    const a = worldToScreen(segment.a, view);
    const b = worldToScreen(segment.b, view);
    const levelT = maxLevel > minLevel ? (segment.level - minLevel) / (maxLevel - minLevel) : 0.5;
    const shade = Math.round(30 + 80 * levelT);
    ctx.strokeStyle = `rgb(${shade}, ${shade + 10}, ${shade + 20})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
}

function drawStreamPaths(view: CanvasView, lines: Point[][]): void {
  ctx.strokeStyle = '#066f74';
  ctx.lineWidth = 1.4;
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

function drawZones(view: CanvasView): void {
  state.zones.forEach((zone) => {
    const topLeft = worldToScreen({ x: zone.x, y: zone.y + zone.height }, view);
    const bottomRight = worldToScreen({ x: zone.x + zone.width, y: zone.y }, view);
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;

    ctx.fillStyle = 'rgba(30, 41, 59, 0.18)';
    ctx.fillRect(topLeft.x, topLeft.y, width, height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(topLeft.x, topLeft.y, width, height);

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.lineWidth = 1;
    const stride = 10;
    for (let x = topLeft.x - height; x < topLeft.x + width; x += stride) {
      ctx.beginPath();
      ctx.moveTo(x, topLeft.y + height);
      ctx.lineTo(x + height, topLeft.y);
      ctx.stroke();
    }
  });
}

function drawBoundaries(view: CanvasView): void {
  state.lineBoundaries.forEach((line) => {
    const a = worldToScreen(line.p1, view);
    const b = worldToScreen(line.p2, view);

    if (line.kind === 'equipotential') {
      ctx.setLineDash([]);
      ctx.strokeStyle = '#c62828';
      ctx.lineWidth = 2.4;
    } else if (line.kind === 'phreatic') {
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = '#1d4ed8';
      ctx.lineWidth = 2.2;
    } else {
      ctx.setLineDash([]);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
    }

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const mid = { x: 0.5 * (a.x + b.x), y: 0.5 * (a.y + b.y) };
    ctx.fillStyle = '#111827';
    ctx.font = '11px "Trebuchet MS", "Gill Sans", sans-serif';

    if (line.kind === 'equipotential') {
      ctx.fillText(`EP ${line.head.toFixed(1)}m`, mid.x + 6, mid.y - 6);
    } else if (line.kind === 'phreatic') {
      ctx.fillText('Phreatic', mid.x + 6, mid.y - 6);
    } else {
      ctx.fillText('No-flow', mid.x + 6, mid.y - 6);
    }
  });
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

  if (state.drag.type === 'zone-draw') {
    const zonePreview = createZoneFromDrag(state.drag.start, state.drag.current);
    if (!zonePreview) {
      return;
    }

    const topLeft = worldToScreen({ x: zonePreview.x, y: zonePreview.y + zonePreview.height }, view);
    const bottomRight = worldToScreen(
      { x: zonePreview.x + zonePreview.width, y: zonePreview.y },
      view,
    );

    ctx.fillStyle = 'rgba(30, 41, 59, 0.15)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
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

  if (!state.standpipeReading) {
    return;
  }

  const waterYWorld = clamp(state.standpipeReading.head, 0, state.domain.height);
  const waterPt = worldToScreen({ x: state.standpipePoint.x, y: waterYWorld }, view);

  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(waterPt.x, waterPt.y);
  ctx.stroke();

  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.arc(waterPt.x, waterPt.y, 3.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '12px "Trebuchet MS", "Gill Sans", sans-serif';
  ctx.fillText(`h=${state.standpipeReading.head.toFixed(2)}m`, waterPt.x + 8, waterPt.y - 8);
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

    const a = worldToScreen(line.p1, view);
    const b = worldToScreen(line.p2, view);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const handleRadius = state.coarsePointer || state.lastPointerType === 'touch' ? 8 : 5;
    [a, b].forEach((handle) => {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, handleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    return;
  }

  const zone = state.zones.find((item) => item.id === state.selected?.id);
  if (!zone) {
    return;
  }

  const topLeft = worldToScreen({ x: zone.x, y: zone.y + zone.height }, view);
  const bottomRight = worldToScreen({ x: zone.x + zone.width, y: zone.y }, view);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  ctx.setLineDash([]);
}

function drawOverlayLegend(view: CanvasView): void {
  const { viewport } = view;
  const boxWidth = clamp(0.46 * viewport.width, 180, 340);
  const boxHeight = 62;
  const x = viewport.left + 8;
  const y = viewport.top + 8;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.strokeRect(x, y, boxWidth, boxHeight);

  ctx.fillStyle = '#0f172a';
  ctx.font = '11px "Trebuchet MS", "Gill Sans", sans-serif';
  ctx.fillText('Contours: equal head spacing', x + 8, y + 19);
  ctx.fillText('Flow lines: traced from Darcy flux', x + 8, y + 34);

  const relation = Math.abs(state.solver.kx - state.solver.ky) < 1e-6
    ? 'Kx = Ky: EP + flow lines should be near orthogonal.'
    : 'Kx != Ky: orthogonality can diverge (anisotropic behavior).';
  ctx.fillText(relation, x + 8, y + 50);
}

function getViewport(): Viewport {
  const rect = canvas.getBoundingClientRect();
  const pad = 14;
  const maxW = Math.max(10, rect.width - 2 * pad);
  const maxH = Math.max(10, rect.height - 2 * pad);
  const domainAspect = state.domain.width / state.domain.height;
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
  return {
    x: view.viewport.left + ((point.x - view.bounds.xMin) / view.bounds.width) * view.viewport.width,
    y: view.viewport.top + (1 - (point.y - view.bounds.yMin) / view.bounds.height) * view.viewport.height,
  };
}

function screenToWorld(point: Point, viewOrViewport: CanvasView | Viewport): Point {
  const view = resolveView(viewOrViewport);
  return {
    x: view.bounds.xMin + ((point.x - view.viewport.left) / view.viewport.width) * view.bounds.width,
    y: view.bounds.yMin + (1 - (point.y - view.viewport.top) / view.viewport.height) * view.bounds.height,
  };
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

function pointInZone(point: Point, zone: NoFlowZone): boolean {
  return (
    point.x >= zone.x &&
    point.x <= zone.x + zone.width &&
    point.y >= zone.y &&
    point.y <= zone.y + zone.height
  );
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

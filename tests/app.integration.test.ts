import { fireEvent } from '@testing-library/dom';

type AppTestApi = {
  getState: () => {
    tool: string;
    pendingLineStart: { x: number; y: number } | null;
    selected: { kind: 'line' | 'polygon'; id: number } | null;
    lineBoundaries: Array<{ kind: string; head: number }>;
    polygons: Array<{ regionType: 'noflow' | 'void' | 'material'; vertices: Array<{ x: number; y: number }> }>;
    solver: { nx: number; ny: number };
    domain: { width: number; height: number };
    view: { textbookScaleBar: boolean; hideEpValues: boolean };
    modifiers: { alt: boolean; ctrl: boolean; meta: boolean };
    standpipePoint: { x: number; y: number } | null;
    allocation: null | {
      allocationCode: string;
      observationPoints: Array<{ label: string; point: { x: number; y: number } }>;
    };
  };
  setTool: (tool: 'select' | 'equipotential' | 'phreatic' | 'noflow-line' | 'noflow-zone' | 'void' | 'soil' | 'standpipe') => void;
  updateCanvasCursor: (point?: { x: number; y: number } | null) => void;
  syncModifierState: (event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; type?: string; key?: string }) => void;
  snapPointToGridNode: (point: { x: number; y: number }) => { x: number; y: number };
  getViewport: () => { left: number; top: number; width: number; height: number };
  loadExampleById: (presetId: string) => void;
  buildPersistedStateSnapshot: () => unknown;
  applyPersistedStateFromRaw: (raw: unknown, fileName: string) => void;
  waitForInitialization: () => Promise<void>;
};

async function loadApp(): Promise<{ __test: AppTestApi }> {
  const app = (await import('../src/main.ts')) as { __test: AppTestApi };
  await app.__test.waitForInitialization();
  return app;
}

function canvasPoint(rx: number, ry: number): { clientX: number; clientY: number } {
  return {
    clientX: 1000 * rx,
    clientY: 620 * ry,
  };
}

describe('Flow Nets app integration', () => {
  it('toggles textbook view and clears current selection', async () => {
    await loadApp();
    const textbookBtn = document.getElementById('toggleTextbookViewBtn') as HTMLButtonElement;
    const inventoryButton = document.querySelector('#inventoryList .inventory-item') as HTMLButtonElement;

    fireEvent.click(inventoryButton);
    expect((document.getElementById('deleteBtn') as HTMLButtonElement).classList.contains('is-hidden')).toBe(false);

    fireEvent.click(textbookBtn);

    expect(textbookBtn.getAttribute('aria-pressed')).toBe('true');
    expect((document.getElementById('deleteBtn') as HTMLButtonElement).classList.contains('is-hidden')).toBe(true);
  });

  it('updates line draw guidance from step 1 to step 2 then reset on escape', async () => {
    const app = await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;
    const toolStep = document.getElementById('toolStep') as HTMLParagraphElement;

    app.__test.setTool('equipotential');
    expect(toolStep.textContent).toContain('Step 1 of 2');

    fireEvent.pointerDown(canvas, { ...canvasPoint(0.22, 0.3), button: 0, pointerId: 1, pointerType: 'mouse' });
    expect(toolStep.textContent).toContain('Step 2 of 2');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(toolStep.textContent).toContain('Step 1 of 2');
  });

  it('shows soil material controls when soil tool is active', async () => {
    const app = await loadApp();
    const newMaterialWrap = document.getElementById('newMaterialWrap') as HTMLDivElement;

    app.__test.setTool('soil');

    expect(newMaterialWrap.classList.contains('is-hidden')).toBe(false);
    expect((document.getElementById('toolHint') as HTMLParagraphElement).textContent).toContain('material region');
  });

  it('creates material polygon by dragging with soil tool', async () => {
    const app = await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;

    app.__test.setTool('soil');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.34, 0.26), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.49, 0.41), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.49, 0.41), button: 0, pointerId: 1, pointerType: 'mouse' });

    const polygons = app.__test.getState().polygons;
    const latest = polygons[polygons.length - 1];
    expect(latest.regionType).toBe('material');
    expect(latest.vertices.length).toBe(4);
  });

  it('creates void polygon by dragging with void tool', async () => {
    const app = await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;

    app.__test.setTool('void');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.58, 0.28), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.72, 0.44), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.72, 0.44), button: 0, pointerId: 1, pointerType: 'mouse' });

    const polygons = app.__test.getState().polygons;
    const latest = polygons[polygons.length - 1];
    expect(latest.regionType).toBe('void');
  });

  it('shows plus/minus cursor modes for select + modifier edits', async () => {
    const app = await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;

    app.__test.setTool('noflow-zone');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.4, 0.55), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.6, 0.7), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.6, 0.7), button: 0, pointerId: 1, pointerType: 'mouse' });

    const topEdgePoint = app.__test.getState().polygons[0].vertices[1];
    fireEvent.click(document.querySelector('#inventoryList .inventory-item') as HTMLButtonElement);
    app.__test.setTool('select');

    app.__test.syncModifierState({ type: 'keydown', key: 'Alt', altKey: true, ctrlKey: false, metaKey: false });
    app.__test.updateCanvasCursor({ x: topEdgePoint.x - 0.4, y: topEdgePoint.y });
    expect(canvas.dataset.cursorMode).toBe('plus');

    const vertex = app.__test.getState().polygons[0].vertices[1];
    app.__test.syncModifierState({ type: 'keyup', key: 'Alt', altKey: false, ctrlKey: false, metaKey: false });
    app.__test.syncModifierState({ type: 'keydown', key: 'Control', altKey: false, ctrlKey: true, metaKey: false });
    app.__test.updateCanvasCursor({ x: vertex.x, y: vertex.y });
    expect(canvas.dataset.cursorMode).toBe('minus');
  });

  it('snaps world points to nearest grid node', async () => {
    const app = await loadApp();
    const state = app.__test.getState();
    const dx = state.domain.width / (state.solver.nx - 1);
    const dy = state.domain.height / (state.solver.ny - 1);

    const snapped = app.__test.snapPointToGridNode({ x: 3.17, y: 2.91 });
    expect(Math.abs(snapped.x / dx - Math.round(snapped.x / dx))).toBeLessThan(1e-9);
    expect(Math.abs(snapped.y / dy - Math.round(snapped.y / dy))).toBeLessThan(1e-9);
  });

  it('computes a fitted viewport with positive dimensions', async () => {
    const app = await loadApp();
    const view = app.__test.getViewport();

    expect(view.left).toBeGreaterThanOrEqual(0);
    expect(view.top).toBeGreaterThanOrEqual(0);
    expect(view.width).toBeGreaterThan(100);
    expect(view.height).toBeGreaterThan(100);
  });

  it('updates active tool using keyboard shortcut keys', async () => {
    await loadApp();
    const epButton = document.querySelector('#toolRow button[data-tool="equipotential"]') as HTMLButtonElement;
    const selectButton = document.querySelector('#toolRow button[data-tool="select"]') as HTMLButtonElement;

    fireEvent.keyDown(window, { key: 'e', code: 'KeyE', altKey: false, ctrlKey: false, metaKey: false });
    expect(epButton.classList.contains('is-active')).toBe(true);

    fireEvent.keyDown(window, { key: ' ', code: 'Space', altKey: false, ctrlKey: false, metaKey: false });
    expect(selectButton.classList.contains('is-active')).toBe(true);
  });

  it('second standpipe tool click clears existing standpipe point', async () => {
    const app = await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;
    const standpipeBtn = document.querySelector('#toolRow button[data-tool="standpipe"]') as HTMLButtonElement;
    const standpipeText = document.getElementById('standpipeText') as HTMLParagraphElement;

    app.__test.setTool('standpipe');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.52, 0.45), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.52, 0.45), button: 0, pointerId: 1, pointerType: 'mouse' });

    fireEvent.click(standpipeBtn);

    expect(app.__test.getState().standpipePoint).toBeNull();
    expect(standpipeText.textContent).toContain('Choose the standpipe tool');
  });

  it('validates and deterministically loads an allocated assessment scenario', async () => {
    const app = await loadApp();
    const studentNumber = document.getElementById('studentNumber') as HTMLInputElement;
    const generateButton = document.getElementById('generateScenarioBtn') as HTMLButtonElement;
    const scenarioError = document.getElementById('scenarioError') as HTMLParagraphElement;

    fireEvent.input(studentNumber, { target: { value: '12345' } });
    fireEvent.click(generateButton);
    expect(scenarioError.textContent).toContain('complete 9-digit student number');

    fireEvent.input(studentNumber, { target: { value: '123456789' } });
    fireEvent.click(generateButton);

    const state = app.__test.getState();
    expect(studentNumber.value).toBe('');
    expect(state.allocation?.allocationCode).toBe('FN-W42-H12-U14-D2-C55-M35-A4-T');
    expect(state.allocation?.observationPoints).toHaveLength(5);
    expect(state.lineBoundaries).toHaveLength(2);
    expect(state.polygons).toHaveLength(1);
    expect(state.polygons[0].regionType).toBe('noflow');
    expect(document.getElementById('allocationObservationPoints')?.children).toHaveLength(5);
  });

  it('persists allocated metadata without retaining the student number', async () => {
    const app = await loadApp();
    const studentNumber = document.getElementById('studentNumber') as HTMLInputElement;

    fireEvent.input(studentNumber, { target: { value: '987654321' } });
    fireEvent.click(document.getElementById('generateScenarioBtn') as HTMLButtonElement);

    const snapshot = app.__test.buildPersistedStateSnapshot();
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain('987654321');
    expect(serialized).toContain('allocationCode');

    app.__test.loadExampleById('uniform-ep');
    expect(app.__test.getState().allocation).toBeNull();

    app.__test.applyPersistedStateFromRaw(snapshot, 'allocated-state.json');
    expect(app.__test.getState().allocation).not.toBeNull();
    expect(document.getElementById('exampleSummary')?.textContent).toContain('Loaded allocated scenario');
  });
});

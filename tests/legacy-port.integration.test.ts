import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, waitFor } from '@testing-library/dom';

type BoundaryRef = { kind: 'line' | 'polygon'; id: number };

type AppTestApi = {
  getState: () => {
    tool: string;
    selected: { kind: 'line' | 'polygon'; id: number } | null;
    lineBoundaries: Array<{ id: number; kind: 'equipotential' | 'phreatic' | 'noflow'; vertices: Array<{ x: number; y: number }> }>;
    polygons: Array<{ id: number; regionType: 'noflow' | 'void' | 'material'; vertices: Array<{ x: number; y: number }> }>;
    standpipePoint: { x: number; y: number } | null;
  };
  setTool: (tool: 'select' | 'equipotential' | 'phreatic' | 'noflow-line' | 'noflow-zone' | 'void' | 'soil' | 'standpipe') => void;
  solveAndRender: () => void;
  deleteSelected: () => void;
  reorderBoundaryZOrder: (draggedRef: BoundaryRef, targetRef: BoundaryRef, position: 'before' | 'after') => boolean;
  loadExampleById: (id: string, options?: { updateUrl?: boolean; solve?: boolean }) => void;
  setZoom: (nextZoom: number, focusWorld?: { x: number; y: number }) => void;
  buildPersistedStateSnapshot: () => {
    lines: Array<{ id: number; vertices: Array<{ x: number; y: number }> }>;
    polygons: Array<{ id: number; regionType: 'noflow' | 'void' | 'material'; kx: number; ky: number }>;
  };
  applyPersistedStateFromRaw: (raw: unknown, fileName: string) => void;
  waitForInitialization: () => Promise<void>;
};

interface PresetFixture {
  id: string;
  summary: string;
  domain: { width: number; height: number };
  solver: { kx: number; ky: number };
  lines: Array<{ kind: string; vertices: Array<{ x: number; y: number }> }>;
  polygons?: Array<{ vertices: Array<{ x: number; y: number }> }>;
}

const presets = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/example-presets.json'), 'utf8'),
) as PresetFixture[];
const presetById = new Map(presets.map((preset) => [preset.id, preset]));

function presetFor(id: string): PresetFixture {
  const preset = presetById.get(id);
  if (!preset) {
    throw new Error(`Missing preset: ${id}`);
  }
  return preset;
}

async function loadApp(query = ''): Promise<{ __test: AppTestApi }> {
  const url = query.length > 0 ? `/${query.startsWith('?') ? query : `?${query}`}` : '/';
  window.history.replaceState({}, '', url);
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

function parseCursorReadout(text: string): { xLabel: string; x: number; yLabel: string; y: number } {
  const match = text.match(/^(x'?):\s*([-0-9.]+),\s*(y'?):\s*([-0-9.]+)$/);
  if (!match) {
    throw new Error(`Unable to parse cursor readout: ${text}`);
  }
  return {
    xLabel: match[1],
    x: Number(match[2]),
    yLabel: match[3],
    y: Number(match[4]),
  };
}

function findInventoryButton(pattern: RegExp): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('#inventoryList .inventory-item'));
  const match = buttons.find((btn) => pattern.test(btn.textContent?.trim() ?? ''));
  if (!match) {
    throw new Error(`No inventory button matching ${pattern}`);
  }
  return match;
}

function inventoryCounts(): { lines: number; noFlowPolygons: number; materialRegions: number } {
  const lineItemPattern = /EP #|Phreatic #|(?:No-flow|Impermeable) line #/;
  const noFlowPolygonItemPattern = /(?:No-flow|Impermeable) polygon #/;
  const materialRegionItemPattern = /Material region #/;

  const items = Array.from(document.querySelectorAll<HTMLElement>('#inventoryList .inventory-item'));
  let lines = 0;
  let noFlowPolygons = 0;
  let materialRegions = 0;
  items.forEach((item) => {
    const text = (item.textContent ?? '').trim();
    if (lineItemPattern.test(text)) {
      lines += 1;
    } else if (noFlowPolygonItemPattern.test(text)) {
      noFlowPolygons += 1;
    } else if (materialRegionItemPattern.test(text)) {
      materialRegions += 1;
    }
  });
  return { lines, noFlowPolygons, materialRegions };
}

describe('legacy coverage port', () => {
  it('draw/solve/probe/export workflow remains functional', async () => {
    const app = await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;

    const startCounts = inventoryCounts();

    app.__test.setTool('phreatic');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.24, 0.32), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.76, 0.24), button: 0, pointerId: 1, pointerType: 'mouse' });

    app.__test.setTool('noflow-zone');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.42, 0.53), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.58, 0.68), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.58, 0.68), button: 0, pointerId: 1, pointerType: 'mouse' });

    app.__test.setTool('standpipe');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.52, 0.45), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.52, 0.45), button: 0, pointerId: 1, pointerType: 'mouse' });

    const counts = inventoryCounts();
    expect(counts.lines).toBeGreaterThanOrEqual(startCounts.lines + 1);
    expect(counts.noFlowPolygons).toBeGreaterThanOrEqual(startCounts.noFlowPolygons + 1);
    expect((document.getElementById('standpipeText') as HTMLParagraphElement).textContent).toContain('head');

    fireEvent.click(document.getElementById('exportBtn') as HTMLButtonElement);
    expect((HTMLCanvasElement.prototype.toDataURL as any).mock.calls.length).toBeGreaterThan(0);
  });

  it('anisotropy status updates when Kx/Ky change', async () => {
    await loadApp();
    const ky = document.getElementById('ky') as HTMLInputElement;
    const kx = document.getElementById('kx') as HTMLInputElement;
    const status = document.getElementById('statusText') as HTMLParagraphElement;

    ky.value = '0.3';
    fireEvent.change(ky);

    await waitFor(() => {
      expect(status.textContent).toContain('anisotropic');
    });

    kx.value = '0.3';
    fireEvent.change(kx);

    await waitFor(() => {
      expect(status.textContent).toContain('isotropic');
    });
  });

  it('reordering line z-order changes hit selection', async () => {
    const app = await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;

    app.__test.setTool('equipotential');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.32, 0.44), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.68, 0.44), button: 0, pointerId: 1, pointerType: 'mouse' });

    app.__test.setTool('noflow-line');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.32, 0.44), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.68, 0.44), button: 0, pointerId: 1, pointerType: 'mouse' });

    app.__test.setTool('select');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.32, 0.44), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.32, 0.44), button: 0, pointerId: 1, pointerType: 'mouse' });

    const selectedBefore = app.__test.getState().selected;
    expect(selectedBefore?.kind).toBe('line');
    const selectedBeforeLine = app.__test.getState().lineBoundaries.find((line) => line.id === selectedBefore?.id);
    expect(selectedBeforeLine?.kind).toBe('noflow');

    const eqLine = app.__test.getState().lineBoundaries.find((line) => line.kind === 'equipotential' && line.id !== 1 && line.id !== 2);
    const nfLine = app.__test.getState().lineBoundaries.find((line) => line.kind === 'noflow');
    expect(eqLine).toBeTruthy();
    expect(nfLine).toBeTruthy();

    app.__test.reorderBoundaryZOrder(
      { kind: 'line', id: eqLine!.id },
      { kind: 'line', id: nfLine!.id },
      'before',
    );

    fireEvent.pointerDown(canvas, { ...canvasPoint(0.32, 0.44), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.32, 0.44), button: 0, pointerId: 1, pointerType: 'mouse' });

    const selectedAfter = app.__test.getState().selected;
    const selectedAfterLine = app.__test.getState().lineBoundaries.find((line) => line.id === selectedAfter?.id);
    expect(selectedAfterLine?.kind).toBe('equipotential');
  });

  it('reordering polygon z-order changes hit selection', async () => {
    const app = await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;

    app.__test.setTool('noflow-zone');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.38, 0.48), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.58, 0.68), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.58, 0.68), button: 0, pointerId: 1, pointerType: 'mouse' });

    fireEvent.pointerDown(canvas, { ...canvasPoint(0.45, 0.55), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.65, 0.75), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.65, 0.75), button: 0, pointerId: 1, pointerType: 'mouse' });

    app.__test.setTool('select');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.53, 0.63), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.53, 0.63), button: 0, pointerId: 1, pointerType: 'mouse' });

    const selectedTop = app.__test.getState().selected;
    expect(selectedTop?.kind).toBe('polygon');

    const polygonIds = app.__test.getState().polygons.map((polygon) => polygon.id);
    const firstId = polygonIds[0];
    const secondId = polygonIds[1];

    app.__test.reorderBoundaryZOrder({ kind: 'polygon', id: firstId }, { kind: 'polygon', id: secondId }, 'before');

    fireEvent.pointerDown(canvas, { ...canvasPoint(0.53, 0.63), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.53, 0.63), button: 0, pointerId: 1, pointerType: 'mouse' });

    const selectedAfter = app.__test.getState().selected;
    expect(selectedAfter).toEqual({ kind: 'polygon', id: firstId });
  });

  it('cursor readout updates on move and clears on leave', async () => {
    await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;
    const readout = document.getElementById('cursorReadout') as HTMLSpanElement;

    fireEvent.pointerMove(canvas, { ...canvasPoint(0.5, 0.5), pointerId: 1, pointerType: 'mouse' });
    expect(readout.textContent).toMatch(/x: [0-9.-]+, y: [0-9.-]+/);

    fireEvent.pointerLeave(canvas, { pointerId: 1, pointerType: 'mouse' });
    expect(readout.textContent).toBe('x: -, y: -');
  });

  it('delete key removes selected inventory item', async () => {
    const app = await loadApp();
    const firstLineItem = findInventoryButton(/EP #|Phreatic #|(?:No-flow|Impermeable) line #/);
    const before = inventoryCounts();

    fireEvent.click(firstLineItem);
    expect(app.__test.getState().selected).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Delete' });

    await waitFor(() => {
      expect(inventoryCounts().lines).toBe(before.lines - 1);
    });
  });

  it('wheel zoom and pan both shift readout at a fixed screen probe', async () => {
    await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;
    const readout = document.getElementById('cursorReadout') as HTMLSpanElement;

    fireEvent.pointerMove(canvas, { ...canvasPoint(0.82, 0.5), pointerId: 1, pointerType: 'mouse' });
    const beforeZoom = parseCursorReadout((readout.textContent ?? '').trim());

    fireEvent.wheel(canvas, { ...canvasPoint(0.5, 0.5), deltaY: -600 });
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.82, 0.5), pointerId: 1, pointerType: 'mouse' });
    const afterZoom = parseCursorReadout((readout.textContent ?? '').trim());

    expect(afterZoom.x).toBeLessThan(beforeZoom.x);

    fireEvent.pointerDown(canvas, { ...canvasPoint(0.55, 0.5), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.8, 0.5), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.8, 0.5), button: 0, pointerId: 1, pointerType: 'mouse' });

    fireEvent.pointerMove(canvas, { ...canvasPoint(0.82, 0.5), pointerId: 1, pointerType: 'mouse' });
    const afterPan = parseCursorReadout((readout.textContent ?? '').trim());
    expect(afterPan.x).toBeLessThan(afterZoom.x);
  });

  it('loads canonical preset from URL and from picker switch', async () => {
    const drainPreset = presetFor('drain');
    await loadApp('?example=drain');

    expect((document.getElementById('exampleSelect') as HTMLSelectElement).value).toBe('drain');
    expect((document.getElementById('exampleSummary') as HTMLParagraphElement).textContent).toContain(drainPreset.summary);
    expect((document.getElementById('domainWidth') as HTMLInputElement).value).toBe(String(drainPreset.domain.width));

    const exampleSelect = document.getElementById('exampleSelect') as HTMLSelectElement;
    exampleSelect.value = 'uniform-ep';
    fireEvent.change(exampleSelect);

    const uniformPreset = presetFor('uniform-ep');
    expect((document.getElementById('kx') as HTMLInputElement).value).toBe(String(uniformPreset.solver.kx));
    expect((document.getElementById('domainWidth') as HTMLInputElement).value).toBe(String(uniformPreset.domain.width));
  });

  it('supports polygon vertex add/remove with Alt/Ctrl modifiers', async () => {
    const app = await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;

    app.__test.setTool('noflow-zone');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.4, 0.55), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.6, 0.7), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.6, 0.7), button: 0, pointerId: 1, pointerType: 'mouse' });

    const topY = Math.min(canvasPoint(0.4, 0.55).clientY, canvasPoint(0.6, 0.7).clientY);
    const rightX = Math.max(canvasPoint(0.4, 0.55).clientX, canvasPoint(0.6, 0.7).clientX);
    const midTopX = 0.5 * (canvasPoint(0.4, 0.55).clientX + canvasPoint(0.6, 0.7).clientX);

    app.__test.setTool('select');
    fireEvent.click(findInventoryButton(/(?:No-flow|Impermeable) polygon #/));

    fireEvent.pointerDown(canvas, { clientX: midTopX, clientY: topY, button: 0, pointerId: 1, pointerType: 'mouse', altKey: true });
    expect(app.__test.getState().polygons[0].vertices.length).toBe(5);

    fireEvent.pointerDown(canvas, { clientX: rightX, clientY: topY, button: 0, pointerId: 1, pointerType: 'mouse', ctrlKey: true });
    expect(app.__test.getState().polygons[0].vertices.length).toBe(4);
  });

  it('line vertex add/remove works only for selected line', async () => {
    const app = await loadApp();
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;

    const ep2 = findInventoryButton(/EP #2/);
    fireEvent.click(ep2);
    fireEvent.pointerDown(canvas, {
      ...canvasPoint(0.02, 0.5),
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
      altKey: true,
    });

    const blocked = app.__test.buildPersistedStateSnapshot();
    const blockedLine1 = blocked.lines.find((line) => line.id === 1);
    const blockedLine2 = blocked.lines.find((line) => line.id === 2);
    expect(blockedLine1?.vertices.length).toBe(2);
    expect(blockedLine2?.vertices.length).toBe(2);

    const ep1 = findInventoryButton(/EP #1/);
    fireEvent.click(ep1);
    fireEvent.pointerDown(canvas, {
      ...canvasPoint(0.02, 0.5),
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
      altKey: true,
    });

    const added = app.__test.buildPersistedStateSnapshot();
    expect(added.lines.find((line) => line.id === 1)?.vertices.length).toBe(3);

    fireEvent.pointerDown(canvas, {
      ...canvasPoint(0.02, 0.5),
      button: 0,
      pointerId: 1,
      pointerType: 'mouse',
      ctrlKey: true,
    });

    const removed = app.__test.buildPersistedStateSnapshot();
    expect(removed.lines.find((line) => line.id === 1)?.vertices.length).toBe(2);
  });

  it('supports transformed coordinate mode and material conversion workflows', async () => {
    const app = await loadApp('?example=anisotropic-demo');
    const canvas = document.getElementById('flowCanvas') as HTMLCanvasElement;
    const readout = document.getElementById('cursorReadout') as HTMLSpanElement;

    fireEvent.pointerMove(canvas, { ...canvasPoint(0.78, 0.52), pointerId: 1, pointerType: 'mouse' });
    const real = parseCursorReadout((readout.textContent ?? '').trim());

    const coordMode = document.getElementById('coordMode') as HTMLSelectElement;
    coordMode.value = 'transformed';
    fireEvent.change(coordMode);
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.78, 0.52), pointerId: 1, pointerType: 'mouse' });
    const transformed = parseCursorReadout((readout.textContent ?? '').trim());
    expect(transformed.xLabel).toBe("x'");
    expect(transformed.x).toBeLessThan(real.x);

    app.__test.loadExampleById('uniform-ep', { updateUrl: false, solve: true });
    app.__test.setTool('noflow-zone');
    fireEvent.pointerDown(canvas, { ...canvasPoint(0.42, 0.53), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas, { ...canvasPoint(0.58, 0.68), button: 0, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas, { ...canvasPoint(0.58, 0.68), button: 0, pointerId: 1, pointerType: 'mouse' });

    app.__test.setTool('select');
    fireEvent.contextMenu(canvas, { ...canvasPoint(0.5, 0.61), button: 2, pointerId: 1, pointerType: 'mouse' });

    const kx = document.getElementById('selectedPolygonKx') as HTMLInputElement;
    const ky = document.getElementById('selectedPolygonKy') as HTMLInputElement;
    kx.value = '9';
    ky.value = '1';
    fireEvent.change(kx);
    fireEvent.change(ky);
    fireEvent.click(document.getElementById('selectedPolygonMaterialToggleBtn') as HTMLButtonElement);

    expect(inventoryCounts().materialRegions).toBeGreaterThan(0);
    const snapshot = app.__test.buildPersistedStateSnapshot();
    expect(snapshot.polygons[0].regionType).toBe('material');
    expect(snapshot.polygons[0].kx).toBe(9);
    expect(snapshot.polygons[0].ky).toBe(1);
  });

  it('loads saved state data structure and refreshes form + summary', async () => {
    const app = await loadApp();

    const savedState = {
      schema: 'flownet2-state',
      version: 1,
      savedAt: new Date().toISOString(),
      domain: { width: 44, height: 14 },
      solver: { nx: 101, ny: 51, kx: 2, ky: 1, maxIter: 5000, tolerance: 0.0001, omega: 1.6 },
      view: { contours: 12, streamlines: 10, autoSolve: true, coordinateMode: 'real', showHeadMap: false, textbookScaleBar: false, hideEpValues: false },
      newHead: 11,
      lines: [
        {
          id: 1,
          kind: 'equipotential',
          vertices: [
            { x: 0, y: 0 },
            { x: 0, y: 14 },
          ],
          head: 11,
        },
      ],
      polygons: [
        {
          id: 2,
          vertices: [
            { x: 17, y: 2 },
            { x: 24, y: 2 },
            { x: 22, y: 7 },
            { x: 16, y: 6 },
          ],
          regionType: 'noflow',
          kx: 2,
          ky: 1,
        },
      ],
      standpipePoint: { x: 30, y: 6 },
    };

    app.__test.applyPersistedStateFromRaw(savedState, 'saved-state.flownet2.json');

    expect((document.getElementById('domainWidth') as HTMLInputElement).value).toBe('44');
    expect((document.getElementById('domainHeight') as HTMLInputElement).value).toBe('14');
    expect((document.getElementById('newHead') as HTMLInputElement).value).toBe('11');
    expect((document.getElementById('exampleSummary') as HTMLParagraphElement).textContent).toContain('Loaded from file');
    expect(inventoryCounts().lines).toBe(1);
    expect(inventoryCounts().noFlowPolygons).toBe(1);
  });
});

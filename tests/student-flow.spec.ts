import fs from 'node:fs';
import { expect, test } from '@playwright/test';

test.describe('Flow Net Studio student workflow', () => {
  interface PresetFixture {
    id: string;
    label: string;
    summary: string;
    domain: { width: number; height: number };
    solver: { kx: number; ky: number };
    view: { coordinateMode: 'real' | 'transformed' };
    lines: Array<{ kind: string; vertices: Array<{ x: number; y: number }> }>;
    polygons?: Array<{ vertices: Array<{ x: number; y: number }> }>;
    standpipePoint?: { x: number; y: number } | null;
  }

  const presets = JSON.parse(fs.readFileSync('public/example-presets.json', 'utf8')) as PresetFixture[];
  const presetById = new Map(presets.map((preset) => [preset.id, preset]));

  const presetFor = (id: string): PresetFixture => {
    const preset = presetById.get(id);
    if (!preset) {
      throw new Error(`Missing preset "${id}" in public/example-presets.json`);
    }
    return preset;
  };

  const presetLineCount = (preset: PresetFixture): number => preset.lines.length;

  const presetPolygonCount = (preset: PresetFixture): number =>
    Array.isArray(preset.polygons) ? preset.polygons.length : 0;

  const inventorySummaryText = (lineCount: number, polygonCount: number): string =>
    `${lineCount} line BCs + ${polygonCount} no-flow polygons`;

  const parseInventorySummary = (text: string): [number, number] => {
    const match = text.match(/(\d+) line BCs \+ (\d+) no-flow polygons/);
    if (!match) {
      throw new Error(`Unable to parse inventory summary: ${text}`);
    }
    return [Number(match[1]), Number(match[2])];
  };

  const parseXRange = (text: string): [number, number] => {
    const match = text.match(/x:([0-9.]+)-([0-9.]+)m/);
    if (!match) {
      throw new Error(`Unable to parse x-range from: ${text}`);
    }
    return [Number(match[1]), Number(match[2])];
  };

  test('student can draw BCs, solve, probe with standpipe, and export PNG', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Flow Net Studio' })).toBeVisible();
    await expect(page.locator('#statusText')).toContainText('Solved');
    const startingSummary = (await page.locator('#inventorySummary').innerText()).trim();
    const [startingLines, startingPolygons] = parseInventorySummary(startingSummary);

    const canvas = page.locator('#flowCanvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    if (!box) {
      throw new Error('Canvas bounding box was null');
    }

    const point = (rx: number, ry: number) => ({
      x: box.x + box.width * rx,
      y: box.y + box.height * ry,
    });

    await page.getByRole('button', { name: 'Phreatic' }).click();
    await expect(page.locator('#toolStep')).toContainText('Step 1 of 2');
    await page.mouse.click(point(0.24, 0.32).x, point(0.24, 0.32).y);
    await expect(page.locator('#toolStep')).toContainText('Step 2 of 2');
    await page.mouse.click(point(0.76, 0.24).x, point(0.76, 0.24).y);
    await expect(page.locator('#inventorySummary')).toContainText(
      inventorySummaryText(startingLines + 1, startingPolygons),
    );

    await page.getByRole('button', { name: 'No-flow polygon' }).click();
    await page.mouse.move(point(0.42, 0.53).x, point(0.42, 0.53).y);
    await page.mouse.down();
    await page.mouse.move(point(0.58, 0.68).x, point(0.58, 0.68).y);
    await page.mouse.up();
    await expect(page.locator('#inventorySummary')).toContainText(
      inventorySummaryText(startingLines + 1, startingPolygons + 1),
    );

    await page.getByRole('button', { name: /Phreatic #/ }).click();
    await expect(page.locator('#selectionType')).toContainText('Phreatic line');

    await page.getByRole('button', { name: 'Standpipe' }).click();
    await page.mouse.click(point(0.52, 0.45).x, point(0.52, 0.45).y);

    await page.getByRole('button', { name: 'Solve now' }).click();
    await expect(page.locator('#statusText')).toContainText('Solved');

    const standpipe = page.locator('#standpipeText');
    await expect(standpipe).toContainText('head');
    await expect(standpipe).toContainText('water rise');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^flownet-.*\.png$/);

    await page.screenshot({ path: 'test-results/student-workflow.png', fullPage: true });
  });

  test('draw guidance supports first-click/second-click flow and Esc cancellation', async ({ page }) => {
    await page.goto('/');
    const startingSummary = (await page.locator('#inventorySummary').innerText()).trim();
    const [startingLines, startingPolygons] = parseInventorySummary(startingSummary);

    const canvas = page.locator('#flowCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('Canvas bounding box was null');
    }

    const click = (rx: number, ry: number) =>
      page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);

    await page.getByRole('button', { name: 'EP line' }).click();
    await expect(page.locator('#toolStep')).toContainText('Step 1 of 2');
    await click(0.2, 0.25);
    await expect(page.locator('#toolStep')).toContainText('Step 2 of 2');

    await page.keyboard.press('Escape');
    await expect(page.locator('#toolStep')).toContainText('Step 1 of 2');
    await expect(page.locator('#inventorySummary')).toContainText(
      inventorySummaryText(startingLines, startingPolygons),
    );
  });

  test('anisotropy change updates solver status', async ({ page }) => {
    await page.goto('/');

    const ky = page.locator('#ky');
    await ky.fill('0.3');
    await ky.dispatchEvent('change');

    await expect(page.locator('#statusText')).toContainText('anisotropic');

    const kx = page.locator('#kx');
    await kx.fill('0.3');
    await kx.dispatchEvent('change');

    await expect(page.locator('#statusText')).toContainText('isotropic');
  });

  test('mobile layout keeps canvas visible and above controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const canvasWrap = page.locator('.canvas-wrap');
    const panel = page.locator('.panel');

    const canvasBox = await canvasWrap.boundingBox();
    const panelBox = await panel.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(panelBox).not.toBeNull();

    if (!canvasBox || !panelBox) {
      throw new Error('Unable to read layout bounding boxes');
    }

    expect(canvasBox.height).toBeGreaterThan(320);
    expect(canvasBox.y).toBeLessThan(panelBox.y);
  });

  test('canvas wrap shrinks again after viewport is reduced', async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 700 });
    await page.goto('/');

    const canvasWrap = page.locator('.canvas-wrap');
    const initialBox = await canvasWrap.boundingBox();
    expect(initialBox).not.toBeNull();
    if (!initialBox) {
      throw new Error('Canvas wrap bounding box was null at initial size');
    }

    await page.setViewportSize({ width: 1300, height: 1100 });
    await page.waitForTimeout(120);
    const grownBox = await canvasWrap.boundingBox();
    expect(grownBox).not.toBeNull();
    if (!grownBox) {
      throw new Error('Canvas wrap bounding box was null after growth');
    }
    expect(grownBox.height).toBeGreaterThan(initialBox.height + 200);

    await page.setViewportSize({ width: 1300, height: 700 });
    await page.waitForTimeout(120);
    const shrunkBox = await canvasWrap.boundingBox();
    expect(shrunkBox).not.toBeNull();
    if (!shrunkBox) {
      throw new Error('Canvas wrap bounding box was null after shrink');
    }
    expect(shrunkBox.height).toBeLessThan(grownBox.height - 200);
    expect(Math.abs(shrunkBox.height - initialBox.height)).toBeLessThan(3);
  });

  test('toolbar shows current cursor coordinates over the canvas', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#flowCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('Canvas bounding box was null');
    }

    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await expect(page.locator('#cursorReadout')).toHaveText(/x: [0-9.-]+, y: [0-9.-]+/);

    await page.mouse.move(box.x - 20, box.y - 20);
    await expect(page.locator('#cursorReadout')).toHaveText('x: -, y: -');
  });

  test('Delete key removes selected boundary from inventory', async ({ page }) => {
    await page.goto('/');
    const startingSummary = (await page.locator('#inventorySummary').innerText()).trim();
    const [startingLines, startingPolygons] = parseInventorySummary(startingSummary);
    expect(startingLines).toBeGreaterThan(0);

    const firstLineItem = page
      .locator('#inventoryList .inventory-item')
      .filter({ hasText: /EP #|Phreatic #|No-flow line #/ })
      .first();
    await firstLineItem.click();
    await expect(page.locator('#selectionType')).not.toContainText('Nothing selected.');

    await page.keyboard.press('Delete');
    await expect(page.locator('#inventorySummary')).toContainText(
      inventorySummaryText(startingLines - 1, startingPolygons),
    );
    await expect(page.locator('#selectionType')).toContainText('Nothing selected.');
  });

  test('zoom controls update view extents for precision drawing', async ({ page }) => {
    await page.goto('/');
    const selectedPresetId = await page.locator('#exampleSelect').inputValue();
    const selectedPreset = presetFor(selectedPresetId);
    const transformedByDefault =
      selectedPreset.view.coordinateMode === 'transformed' &&
      Math.abs(selectedPreset.solver.kx - selectedPreset.solver.ky) > 1e-9;
    const displayScaleX = transformedByDefault ? Math.sqrt(selectedPreset.solver.ky / selectedPreset.solver.kx) : 1;

    await expect(page.locator('#zoomLabel')).toHaveText('100%');
    const promptBefore = (await page.locator('#canvasPrompt').innerText()).trim();
    const [beforeMin, beforeMax] = parseXRange(promptBefore);
    expect(beforeMin).toBeCloseTo(0, 1);
    expect(beforeMax).toBeCloseTo(selectedPreset.domain.width * displayScaleX, 1);

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(page.locator('#zoomLabel')).toHaveText('125%');

    const promptAfter = (await page.locator('#canvasPrompt').innerText()).trim();
    const [afterMin, afterMax] = parseXRange(promptAfter);
    expect(afterMin).toBeGreaterThan(beforeMin);
    expect(afterMax).toBeLessThan(beforeMax);
  });

  test('pan mode drag shifts viewed x-range', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Pan: Off' }).click();
    await expect(page.getByRole('button', { name: 'Pan: On' })).toBeVisible();

    const promptBefore = (await page.locator('#canvasPrompt').innerText()).trim();
    const [beforeMin] = parseXRange(promptBefore);

    const canvas = page.locator('#flowCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('Canvas bounding box was null');
    }

    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5);
    await page.mouse.up();

    const promptAfter = (await page.locator('#canvasPrompt').innerText()).trim();
    const [afterMin] = parseXRange(promptAfter);
    expect(afterMin).toBeLessThan(beforeMin);
  });

  test('url parameter loads canonical example case', async ({ page }) => {
    const drainPreset = presetFor('drain');
    await page.goto('/?example=drain');

    await expect(page.locator('#exampleSelect')).toHaveValue('drain');
    await expect(page.locator('#exampleSummary')).toContainText(drainPreset.label);
    await expect(page.locator('#domainWidth')).toHaveValue(String(drainPreset.domain.width));
    await expect(page.locator('#inventorySummary')).toContainText(
      inventorySummaryText(presetLineCount(drainPreset), presetPolygonCount(drainPreset)),
    );
    if (presetPolygonCount(drainPreset) > 0) {
      await expect(page.getByRole('button', { name: /No-flow polygon #/ })).toBeVisible();
    }
  });

  test('student can switch to drain example from preset picker', async ({ page }) => {
    const drainPreset = presetFor('drain');
    await page.goto('/');

    await page.selectOption('#exampleSelect', 'drain');

    await expect(page.locator('#domainWidth')).toHaveValue(String(drainPreset.domain.width));
    await expect(page.locator('#kx')).toHaveValue(String(drainPreset.solver.kx));
    await expect(page.locator('#inventorySummary')).toContainText(
      inventorySummaryText(presetLineCount(drainPreset), presetPolygonCount(drainPreset)),
    );
    if (drainPreset.standpipePoint) {
      await expect(page.locator('#standpipeText')).not.toContainText('Choose the standpipe tool');
    }
    await expect(page.locator('#exampleSummary')).toContainText(drainPreset.label);
  });

  test('student can insert and delete polygon vertices with keyboard modifiers', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#flowCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('Canvas bounding box was null');
    }

    const point = (rx: number, ry: number) => ({
      x: box.x + box.width * rx,
      y: box.y + box.height * ry,
    });
    const start = point(0.4, 0.55);
    const end = point(0.6, 0.7);
    const topY = Math.min(start.y, end.y);
    const rightX = Math.max(start.x, end.x);
    const midTopX = 0.5 * (start.x + end.x);

    await page.getByRole('button', { name: 'No-flow polygon' }).click();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();

    await expect(page.getByRole('button', { name: /No-flow polygon #\d+ \(4 vertices\)/ })).toBeVisible();

    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.keyboard.down('Alt');
    await page.mouse.click(midTopX, topY);
    await page.keyboard.up('Alt');
    await expect(page.getByRole('button', { name: /No-flow polygon #\d+ \(5 vertices\)/ })).toBeVisible();

    await page.keyboard.down('Control');
    await page.mouse.click(rightX, topY);
    await page.keyboard.up('Control');
    await expect(page.getByRole('button', { name: /No-flow polygon #\d+ \(4 vertices\)/ })).toBeVisible();
  });

  test('selected line supports alt-add and ctrl-delete vertices only on selected object', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#flowCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('Canvas bounding box was null');
    }

    const point = (rx: number, ry: number) => ({
      x: box.x + box.width * rx,
      y: box.y + box.height * ry,
    });
    const leftBoundaryMid = point(0.02, 0.5);

    await page.getByRole('button', { name: /EP #2/ }).click();
    await page.keyboard.down('Alt');
    await page.mouse.click(leftBoundaryMid.x, leftBoundaryMid.y);
    await page.keyboard.up('Alt');

    const blockedDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save state' }).click();
    const blockedDownload = await blockedDownloadPromise;
    const blockedPath = await blockedDownload.path();
    expect(blockedPath).not.toBeNull();
    if (!blockedPath) {
      throw new Error('Save-state download path was null');
    }
    const blockedState = JSON.parse(fs.readFileSync(blockedPath, 'utf8'));
    const blockedLine1 = blockedState.lineBoundaries.find((line: { id: number }) => line.id === 1);
    const blockedLine2 = blockedState.lineBoundaries.find((line: { id: number }) => line.id === 2);
    expect(blockedLine1.vertices).toHaveLength(2);
    expect(blockedLine2.vertices).toHaveLength(2);

    await page.getByRole('button', { name: /EP #1/ }).click();
    await page.keyboard.down('Alt');
    await page.mouse.click(leftBoundaryMid.x, leftBoundaryMid.y);
    await page.keyboard.up('Alt');

    const addDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save state' }).click();
    const addDownload = await addDownloadPromise;
    const addPath = await addDownload.path();
    expect(addPath).not.toBeNull();
    if (!addPath) {
      throw new Error('Save-state download path was null');
    }
    const addedState = JSON.parse(fs.readFileSync(addPath, 'utf8'));
    const addedLine1 = addedState.lineBoundaries.find((line: { id: number }) => line.id === 1);
    expect(addedLine1.vertices).toHaveLength(3);

    await page.keyboard.down('Control');
    await page.mouse.click(leftBoundaryMid.x, leftBoundaryMid.y);
    await page.keyboard.up('Control');

    const removeDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save state' }).click();
    const removeDownload = await removeDownloadPromise;
    const removePath = await removeDownload.path();
    expect(removePath).not.toBeNull();
    if (!removePath) {
      throw new Error('Save-state download path was null');
    }
    const removedState = JSON.parse(fs.readFileSync(removePath, 'utf8'));
    const removedLine1 = removedState.lineBoundaries.find((line: { id: number }) => line.id === 1);
    expect(removedLine1.vertices).toHaveLength(2);
  });

  test('select cursor shows plus/minus modes for polygon add/remove shortcuts', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#flowCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('Canvas bounding box was null');
    }

    const point = (rx: number, ry: number) => ({
      x: box.x + box.width * rx,
      y: box.y + box.height * ry,
    });
    const start = point(0.4, 0.55);
    const end = point(0.6, 0.7);
    const topY = Math.min(start.y, end.y);
    const rightX = Math.max(start.x, end.x);
    const midTopX = 0.5 * (start.x + end.x);

    await page.getByRole('button', { name: 'No-flow polygon' }).click();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();

    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.mouse.move(midTopX, topY);

    await page.keyboard.down('Alt');
    await expect.poll(async () =>
      page.locator('#flowCanvas').evaluate((el) => el.getAttribute('data-cursor-mode')),
    ).toBe('plus');
    await page.keyboard.up('Alt');

    await page.mouse.move(rightX, topY);
    await page.keyboard.down('Control');
    await expect.poll(async () =>
      page.locator('#flowCanvas').evaluate((el) => el.getAttribute('data-cursor-mode')),
    ).toBe('minus');
    await page.keyboard.up('Control');
  });

  test('anisotropic transformed-coordinate toggle changes displayed x-extent', async ({ page }) => {
    const anisotropicPreset = presetFor('anisotropic-demo');
    await page.goto('/?example=anisotropic-demo');

    await expect(page.locator('#statusText')).toContainText('anisotropic');
    await expect(page.locator('#coordMode')).toHaveValue('real');

    const promptReal = (await page.locator('#canvasPrompt').innerText()).trim();
    const [realMin, realMax] = parseXRange(promptReal);
    expect(realMin).toBeCloseTo(0, 1);
    expect(realMax).toBeCloseTo(anisotropicPreset.domain.width, 1);

    await page.selectOption('#coordMode', 'transformed');
    await expect(page.locator('#coordMode')).toHaveValue('transformed');
    await expect(page.locator('#canvasPrompt')).toContainText("coords: transformed");

    const promptTransformed = (await page.locator('#canvasPrompt').innerText()).trim();
    const [transformedMin, transformedMax] = parseXRange(promptTransformed);
    const transformedWidth = anisotropicPreset.domain.width * Math.sqrt(anisotropicPreset.solver.ky / anisotropicPreset.solver.kx);
    expect(transformedMin).toBeCloseTo(0, 1);
    expect(transformedMax).toBeCloseTo(transformedWidth, 1);
  });

  test('student can load a saved state JSON file', async ({ page }) => {
    await page.goto('/');

    const savedState = {
      schema: 'flownet2-state',
      version: 1,
      savedAt: new Date().toISOString(),
      domain: { width: 44, height: 14 },
      solver: { nx: 101, ny: 51, kx: 2, ky: 1, maxIter: 5000, tolerance: 0.0001, omega: 1.6 },
      view: { contours: 12, streamlines: 10, autoSolve: true, coordinateMode: 'real' },
      newHead: 11,
      lineBoundaries: [
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
        },
      ],
      standpipePoint: { x: 30, y: 6 },
    };

    await page.setInputFiles('#loadStateInput', {
      name: 'saved-state.flownet2.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(savedState)),
    });

    await expect(page.locator('#domainWidth')).toHaveValue('44');
    await expect(page.locator('#domainHeight')).toHaveValue('14');
    await expect(page.locator('#inventorySummary')).toContainText('1 line BCs + 1 no-flow polygons');
    await expect(page.locator('#newHead')).toHaveValue('11');
    await expect(page.locator('#exampleSummary')).toContainText('Loaded from file');
    await expect(page.locator('#statusText')).toContainText('Solved');
  });
});

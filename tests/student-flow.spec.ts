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

  const parseCursorReadout = (text: string): { xLabel: string; x: number; yLabel: string; y: number } => {
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
  };

  const parseStandpipePoint = (text: string): [number, number] => {
    const match = text.match(/Point \(([-0-9.]+)m, ([-0-9.]+)m\):/);
    if (!match) {
      throw new Error(`Unable to parse standpipe point from: ${text}`);
    }
    return [Number(match[1]), Number(match[2])];
  };

  const parseNoFlowPolygonId = (text: string): number => {
    const match = text.match(/No-flow polygon #(\d+)/);
    if (!match) {
      throw new Error(`Unable to parse polygon id from: ${text}`);
    }
    return Number(match[1]);
  };

  test('student can draw BCs, solve, probe with standpipe, and export PNG', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Flow Nets' })).toBeVisible();
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

    await page.locator('#toolRow button[data-tool="noflow-zone"]').click();
    await page.mouse.move(point(0.42, 0.53).x, point(0.42, 0.53).y);
    await page.mouse.down();
    await page.mouse.move(point(0.58, 0.68).x, point(0.58, 0.68).y);
    await page.mouse.up();
    await expect(page.locator('#inventorySummary')).toContainText(
      inventorySummaryText(startingLines + 1, startingPolygons + 1),
    );

    await page.getByRole('button', { name: /Phreatic #/ }).click();
    await expect(page.locator('#deleteBtn')).not.toHaveClass(/is-hidden/);

    await page.getByRole('button', { name: 'Standpipe' }).click();
    await page.mouse.click(point(0.52, 0.45).x, point(0.52, 0.45).y);

    await expect(page.locator('#statusText')).toContainText('Solved');

    const standpipe = page.locator('#standpipeText');
    await expect(standpipe).toContainText('head');
    await expect(standpipe).toContainText('water rise');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save PNG' }).click();
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

    await page.locator('#toolRow button[data-tool="equipotential"]').click();
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

  test('reordering boundary list updates line z-order hit selection', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#flowCanvas');
    const clickCanvas = async (rx: number, ry: number): Promise<void> => {
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      if (!box) {
        throw new Error('Canvas bounding box was null');
      }
      await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);
    };

    await page.locator('#toolRow button[data-tool="equipotential"]').click();
    await clickCanvas(0.32, 0.44);
    await clickCanvas(0.68, 0.44);

    await page.locator('#toolRow button[data-tool="noflow-line"]').click();
    await clickCanvas(0.32, 0.44);
    await clickCanvas(0.68, 0.44);

    await page.locator('#toolRow button[data-tool="select"]').click();
    await clickCanvas(0.32, 0.44);
    await expect(page.locator('#selectedHeadRow')).toHaveClass(/is-hidden/);

    const epLineItem = page.locator('#inventoryList .inventory-item', { hasText: /^EP #/ }).first();
    const noFlowLineItem = page.locator('#inventoryList .inventory-item', { hasText: /^No-flow line #/ }).first();
    await epLineItem.dragTo(noFlowLineItem, { targetPosition: { x: 8, y: 2 } });

    await clickCanvas(0.32, 0.44);
    await expect(page.locator('#selectedHeadRow')).not.toHaveClass(/is-hidden/);
  });

  test('reordering boundary list updates polygon z-order hit selection', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#flowCanvas');
    const clickCanvas = async (rx: number, ry: number): Promise<void> => {
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      if (!box) {
        throw new Error('Canvas bounding box was null');
      }
      await page.mouse.click(box.x + box.width * rx, box.y + box.height * ry);
    };
    const dragCanvasRect = async (startRx: number, startRy: number, endRx: number, endRy: number): Promise<void> => {
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      if (!box) {
        throw new Error('Canvas bounding box was null');
      }
      await page.mouse.move(box.x + box.width * startRx, box.y + box.height * startRy);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * endRx, box.y + box.height * endRy);
      await page.mouse.up();
    };

    await page.locator('#toolRow button[data-tool="noflow-zone"]').click();
    await dragCanvasRect(0.38, 0.48, 0.58, 0.68);
    await dragCanvasRect(0.45, 0.55, 0.65, 0.75);

    await page.locator('#toolRow button[data-tool="select"]').click();

    const polygonItems = page.locator('#inventoryList .inventory-item', { hasText: /^No-flow polygon #/ });
    const topPolygonItem = polygonItems.nth(0);
    const secondPolygonItem = polygonItems.nth(1);
    const topPolygonId = parseNoFlowPolygonId(await topPolygonItem.innerText());
    const secondPolygonId = parseNoFlowPolygonId(await secondPolygonItem.innerText());

    await clickCanvas(0.53, 0.63);
    await expect(page.locator('#inventoryList .inventory-item.is-selected').first())
      .toContainText(new RegExp(`No-flow polygon #${topPolygonId}`));

    await secondPolygonItem.dragTo(topPolygonItem, { targetPosition: { x: 8, y: 2 } });

    await clickCanvas(0.53, 0.63);
    await expect(page.locator('#inventoryList .inventory-item.is-selected').first())
      .toContainText(new RegExp(`No-flow polygon #${secondPolygonId}`));
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

  test('tool buttons expose shortcut tooltips and keyboard shortcuts switch tools', async ({ page }) => {
    await page.goto('/');

    const selectTool = page.locator('#toolRow button[data-tool="select"]');
    const epTool = page.locator('#toolRow button[data-tool="equipotential"]');
    const flTool = page.locator('#toolRow button[data-tool="noflow-line"]');
    const phreaticTool = page.locator('#toolRow button[data-tool="phreatic"]');
    const impermeableAreaTool = page.locator('#toolRow button[data-tool="noflow-zone"]');
    const materialAreaTool = page.locator('#toolRow button[data-tool="soil"]');
    const standpipeTool = page.locator('#toolRow button[data-tool="standpipe"]');

    await expect(selectTool).toHaveAttribute('title', /Space/);
    await expect(epTool).toHaveAttribute('title', /\(E\)/);
    await expect(flTool).toHaveAttribute('title', /\(F\)/);
    await expect(phreaticTool).toHaveAttribute('title', /\(P\)/);
    await expect(impermeableAreaTool).toHaveAttribute('title', /\(I\)/);
    await expect(materialAreaTool).toHaveAttribute('title', /\(M\)/);
    await expect(standpipeTool).toHaveAttribute('title', /\(S\)/);

    await page.locator('#flowCanvas').click();

    await page.keyboard.press('e');
    await expect(epTool).toHaveClass(/is-active/);
    await expect(page.locator('#newHeadWrap')).not.toHaveClass(/is-hidden/);

    await page.keyboard.press('f');
    await expect(flTool).toHaveClass(/is-active/);

    await page.keyboard.press('p');
    await expect(phreaticTool).toHaveClass(/is-active/);

    await page.keyboard.press('i');
    await expect(impermeableAreaTool).toHaveClass(/is-active/);
    await expect(page.locator('#newMaterialWrap')).toHaveClass(/is-hidden/);

    await page.keyboard.press('m');
    await expect(materialAreaTool).toHaveClass(/is-active/);
    await expect(page.locator('#newMaterialWrap')).not.toHaveClass(/is-hidden/);

    await page.keyboard.press('s');
    await expect(standpipeTool).toHaveClass(/is-active/);

    await page.keyboard.press('Space');
    await expect(selectTool).toHaveClass(/is-active/);
    await expect(page.locator('#newHeadWrap')).toHaveClass(/is-hidden/);
    await expect(page.locator('#newMaterialWrap')).toHaveClass(/is-hidden/);
  });

  test('standpipe can be repositioned by click-drag', async ({ page }) => {
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

    await page.getByRole('button', { name: 'Standpipe' }).click();
    await page.mouse.click(point(0.3, 0.6).x, point(0.3, 0.6).y);

    const beforeText = (await page.locator('#standpipeText').innerText()).trim();
    const [beforeX] = parseStandpipePoint(beforeText);

    await page.mouse.move(point(0.3, 0.6).x, point(0.3, 0.6).y);
    await page.mouse.down();
    await page.mouse.move(point(0.7, 0.45).x, point(0.7, 0.45).y);
    await page.mouse.up();

    const afterText = (await page.locator('#standpipeText').innerText()).trim();
    const [afterX] = parseStandpipePoint(afterText);
    expect(afterX).toBeGreaterThan(beforeX + 1);
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
    await expect(page.locator('#deleteBtn')).not.toHaveClass(/is-hidden/);

    await page.keyboard.press('Delete');
    await expect(page.locator('#inventorySummary')).toContainText(
      inventorySummaryText(startingLines - 1, startingPolygons),
    );
    await expect(page.locator('#deleteBtn')).toHaveClass(/is-hidden/);
  });

  test('wheel zoom updates cursor coordinates for precision drawing', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#flowCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('Canvas bounding box was null');
    }

    const focus = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
    const probe = { x: box.x + box.width * 0.82, y: box.y + box.height * 0.5 };

    await page.mouse.move(probe.x, probe.y);
    const before = parseCursorReadout((await page.locator('#cursorReadout').innerText()).trim());

    await page.mouse.move(focus.x, focus.y);
    await page.mouse.wheel(0, -600);
    await page.mouse.move(probe.x, probe.y);

    const after = parseCursorReadout((await page.locator('#cursorReadout').innerText()).trim());
    expect(after.xLabel).toBe(before.xLabel);
    expect(after.x).toBeLessThan(before.x - 0.25);
  });

  test('dragging empty canvas in Select pans the viewed range', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#flowCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('Canvas bounding box was null');
    }

    const focus = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
    const probe = { x: box.x + box.width * 0.65, y: box.y + box.height * 0.5 };

    await page.mouse.move(focus.x, focus.y);
    await page.mouse.wheel(0, -600);
    await page.mouse.move(probe.x, probe.y);
    const before = parseCursorReadout((await page.locator('#cursorReadout').innerText()).trim());

    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5);
    await page.mouse.up();

    await page.mouse.move(probe.x, probe.y);
    const after = parseCursorReadout((await page.locator('#cursorReadout').innerText()).trim());
    expect(after.x).toBeLessThan(before.x - 0.25);
  });

  test('url parameter loads canonical example case', async ({ page }) => {
    const drainPreset = presetFor('drain');
    await page.goto('/?example=drain');

    await expect(page.locator('#exampleSelect')).toHaveValue('drain');
    await expect(page.locator('#exampleSummary')).toContainText(drainPreset.summary);
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
    await expect(page.locator('#exampleSummary')).toContainText(drainPreset.summary);
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

    await page.locator('#toolRow button[data-tool="noflow-zone"]').click();
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
    const blockedLine1 = blockedState.lines.find((line: { id: number }) => line.id === 1);
    const blockedLine2 = blockedState.lines.find((line: { id: number }) => line.id === 2);
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
    const addedLine1 = addedState.lines.find((line: { id: number }) => line.id === 1);
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
    const removedLine1 = removedState.lines.find((line: { id: number }) => line.id === 1);
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

    await page.locator('#toolRow button[data-tool="noflow-zone"]').click();
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

    const canvas = page.locator('#flowCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      throw new Error('Canvas bounding box was null');
    }

    const probe = { x: box.x + box.width * 0.78, y: box.y + box.height * 0.52 };
    await page.mouse.move(probe.x, probe.y);
    const realReadout = parseCursorReadout((await page.locator('#cursorReadout').innerText()).trim());
    expect(realReadout.xLabel).toBe('x');
    expect(realReadout.yLabel).toBe('y');

    await page.selectOption('#coordMode', 'transformed');
    await expect(page.locator('#coordMode')).toHaveValue('transformed');
    await page.mouse.move(probe.x, probe.y);
    const transformedReadout = parseCursorReadout((await page.locator('#cursorReadout').innerText()).trim());
    expect(transformedReadout.xLabel).toBe("x'");
    expect(transformedReadout.yLabel).toBe("y'");

    expect(Math.sqrt(anisotropicPreset.solver.ky / anisotropicPreset.solver.kx)).toBeLessThan(1);
    expect(transformedReadout.x).toBeLessThan(realReadout.x - 0.5);
  });

  test('polygon can be converted to a material region with right-click editing', async ({ page }) => {
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

    const polygonStart = point(0.42, 0.53);
    const polygonEnd = point(0.58, 0.68);
    const polygonCenter = point(0.5, 0.61);

    await page.locator('#toolRow button[data-tool="noflow-zone"]').click();
    await page.mouse.move(polygonStart.x, polygonStart.y);
    await page.mouse.down();
    await page.mouse.move(polygonEnd.x, polygonEnd.y);
    await page.mouse.up();

    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.mouse.click(polygonCenter.x, polygonCenter.y, { button: 'right' });

    await expect(page.locator('#selectedPolygonMaterialPanel')).not.toHaveClass(/is-hidden/);
    await expect(page.locator('#selectedPolygonMaterialToggleBtn')).toContainText('Convert to material');

    const selectedKx = page.locator('#selectedPolygonKx');
    const selectedKy = page.locator('#selectedPolygonKy');
    await selectedKx.fill('9');
    await selectedKx.dispatchEvent('change');
    await selectedKy.fill('1');
    await selectedKy.dispatchEvent('change');
    await page.locator('#selectedPolygonMaterialToggleBtn').click();

    await expect(page.locator('#inventorySummary')).toContainText('1 material region');
    await expect(page.getByRole('button', { name: /Material region #/ })).toBeVisible();

    const saveDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save state' }).click();
    const saveDownload = await saveDownloadPromise;
    const savePath = await saveDownload.path();
    expect(savePath).not.toBeNull();
    if (!savePath) {
      throw new Error('Save-state download path was null');
    }
    const savedState = JSON.parse(fs.readFileSync(savePath, 'utf8'));
    expect(savedState.polygons[0].regionType).toBe('material');
    expect(savedState.polygons[0].kx).toBe(9);
    expect(savedState.polygons[0].ky).toBe(1);

    await page.setInputFiles('#loadStateInput', {
      name: 'material-region-state.flownet2.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(savedState)),
    });
    await expect(page.getByRole('button', { name: /Material region #/ })).toBeVisible();
  });

  test('material area tool creates a material region directly', async ({ page }) => {
    await page.goto('/');

    const canvas = page.locator('#flowCanvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const point = (rx: number, ry: number) => ({
      x: box!.x + box!.width * rx,
      y: box!.y + box!.height * ry,
    });

    await page.locator('#toolRow button[data-tool="soil"]').click();
    await expect(page.locator('#newMaterialWrap')).not.toHaveClass(/is-hidden/);

    const newMaterialKxInput = page.locator('#newMaterialKx');
    const newMaterialKyInput = page.locator('#newMaterialKy');
    await newMaterialKxInput.fill('7');
    await newMaterialKyInput.fill('3');

    const polygonStart = point(0.34, 0.26);
    const polygonEnd = point(0.49, 0.41);
    await page.mouse.move(polygonStart.x, polygonStart.y);
    await page.mouse.down();
    await page.mouse.move(polygonEnd.x, polygonEnd.y);
    await page.mouse.up();

    await expect(page.locator('#inventorySummary')).toContainText('1 material region');
    await expect(page.locator('#selectedPolygonMaterialToggleBtn')).toContainText('Set as impermeable');

    const saveDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save state' }).click();
    const saveDownload = await saveDownloadPromise;
    const savePath = await saveDownload.path();
    expect(savePath).not.toBeNull();
    const savedState = JSON.parse(fs.readFileSync(savePath as string, 'utf8'));
    expect(savedState.polygons[0].regionType).toBe('material');
    expect(savedState.polygons[0].kx).toBe(7);
    expect(savedState.polygons[0].ky).toBe(3);
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

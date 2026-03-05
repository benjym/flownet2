import { expect, test } from '@playwright/test';

test.describe('Flow Net Studio student workflow', () => {
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
    await expect(page.locator('#inventorySummary')).toContainText('3 line BCs');

    await page.getByRole('button', { name: 'No-flow polygon' }).click();
    await page.mouse.move(point(0.42, 0.53).x, point(0.42, 0.53).y);
    await page.mouse.down();
    await page.mouse.move(point(0.58, 0.68).x, point(0.58, 0.68).y);
    await page.mouse.up();
    await expect(page.locator('#inventorySummary')).toContainText('3 line BCs + 1 no-flow polygons');

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
    await expect(page.locator('#inventorySummary')).toContainText('2 line BCs + 0 no-flow polygons');
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

  test('Delete key removes selected boundary from inventory', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'EP #1 (h=10.00m)' }).click();
    await expect(page.locator('#selectionType')).toContainText('Equipotential line #1');

    await page.keyboard.press('Delete');
    await expect(page.locator('#inventorySummary')).toContainText('1 line BCs + 0 no-flow polygons');
    await expect(page.locator('#selectionType')).toContainText('Nothing selected.');
  });

  test('zoom controls update view extents for precision drawing', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#zoomLabel')).toHaveText('100%');
    const promptBefore = (await page.locator('#canvasPrompt').innerText()).trim();
    const [beforeMin, beforeMax] = parseXRange(promptBefore);
    expect(beforeMin).toBeCloseTo(0, 1);
    expect(beforeMax).toBeCloseTo(30, 1);

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
    await page.goto('/?example=cutoff-wall');

    await expect(page.locator('#exampleSelect')).toHaveValue('cutoff-wall');
    await expect(page.locator('#exampleSummary')).toContainText(/cutoff wall/i);
    await expect(page.locator('#domainWidth')).toHaveValue('38');
    await expect(page.locator('#inventorySummary')).toContainText('2 line BCs + 1 no-flow polygons');
    await expect(page.getByRole('button', { name: /No-flow polygon #/ })).toBeVisible();
  });

  test('student can switch to drain example from preset picker', async ({ page }) => {
    await page.goto('/');

    await page.selectOption('#exampleSelect', 'drain');

    await expect(page.locator('#domainWidth')).toHaveValue('32');
    await expect(page.locator('#kx')).toHaveValue('1');
    await expect(page.locator('#inventorySummary')).toContainText('3 line BCs + 1 no-flow polygons');
    await expect(page.getByRole('button', { name: /EP #3/ })).toBeVisible();
    await expect(page.locator('#standpipeText')).toContainText('head');
    await expect(page.locator('#exampleSummary')).toContainText(/drain/i);
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
    await page.goto('/?example=anisotropic-demo');

    await expect(page.locator('#statusText')).toContainText('anisotropic');
    await expect(page.locator('#coordMode')).toHaveValue('real');

    const promptReal = (await page.locator('#canvasPrompt').innerText()).trim();
    const [realMin, realMax] = parseXRange(promptReal);
    expect(realMin).toBeCloseTo(0, 1);
    expect(realMax).toBeCloseTo(30, 1);

    await page.selectOption('#coordMode', 'transformed');
    await expect(page.locator('#coordMode')).toHaveValue('transformed');
    await expect(page.locator('#canvasPrompt')).toContainText("coords: transformed");

    const promptTransformed = (await page.locator('#canvasPrompt').innerText()).trim();
    const [transformedMin, transformedMax] = parseXRange(promptTransformed);
    expect(transformedMin).toBeCloseTo(0, 1);
    expect(transformedMax).toBeCloseTo(15, 1);
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
          p1: { x: 0, y: 0 },
          p2: { x: 0, y: 14 },
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

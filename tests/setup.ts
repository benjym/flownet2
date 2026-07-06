import { beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve(process.cwd(), 'index.html');
const presetPath = path.resolve(process.cwd(), 'public/example-presets.json');
const indexHtml = fs.readFileSync(htmlPath, 'utf8');
const examplePresets = JSON.parse(fs.readFileSync(presetPath, 'utf8'));

class PointerEventPolyfill extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = init.isPrimary ?? true;
  }
}

function createCanvasContext(): CanvasRenderingContext2D {
  const gradient = {
    addColorStop: () => undefined,
  } as unknown as CanvasGradient;

  const pattern = {} as CanvasPattern;

  const ctx: Partial<CanvasRenderingContext2D> = {
    canvas: {} as HTMLCanvasElement,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    closePath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    rect: () => undefined,
    arc: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    clip: () => undefined,
    clearRect: () => undefined,
    fillRect: () => undefined,
    strokeRect: () => undefined,
    setLineDash: () => undefined,
    strokeText: () => undefined,
    fillText: () => undefined,
    measureText: (text: string) => ({
      width: text.length * 7,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 3,
    }) as TextMetrics,
    createLinearGradient: () => gradient,
    createPattern: () => pattern,
    drawImage: () => undefined,
    translate: () => undefined,
    rotate: () => undefined,
    scale: () => undefined,
    setTransform: () => undefined,
    resetTransform: () => undefined,
  };

  return ctx as CanvasRenderingContext2D;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();

  document.documentElement.innerHTML = indexHtml;
  document.body.innerHTML = document.body.innerHTML;

  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value: 1,
  });

  vi.stubGlobal('PointerEvent', PointerEventPolyfill);
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
  });

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })),
  );

  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: () => '',
  }));

  const canvasProto = HTMLCanvasElement.prototype as HTMLCanvasElement & {
    __capturePointerId?: number;
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        x: 0,
        y: 0,
        width: 1000,
        height: 620,
        top: 0,
        left: 0,
        right: 1000,
        bottom: 620,
        toJSON: () => ({}),
      }) as DOMRect,
  );

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    const ctx = createCanvasContext();
    Object.defineProperty(ctx, 'canvas', { value: this, configurable: true });
    return ctx;
  });

  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,abc');

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:mock-state-url'),
  });

  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });

  Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    writable: true,
    value: function (pointerId: number): void {
      (this as typeof canvasProto).__capturePointerId = pointerId;
    },
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'releasePointerCapture', {
    configurable: true,
    writable: true,
    value: function (): void {
      (this as typeof canvasProto).__capturePointerId = undefined;
    },
  });

  Object.defineProperty(HTMLCanvasElement.prototype, 'hasPointerCapture', {
    configurable: true,
    writable: true,
    value: function (pointerId: number): boolean {
      return (this as typeof canvasProto).__capturePointerId === pointerId;
    },
  });

  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      ({
        ok: true,
        json: async () => examplePresets,
      }) as Response,
    ),
  );
});

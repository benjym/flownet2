export interface Point2D {
  x: number;
  y: number;
}

export interface GridSnapSettings {
  width: number;
  height: number;
  nx: number;
  ny: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function projectPointToSegment(point: Point2D, a: Point2D, b: Point2D): Point2D {
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

export function pointInPolygon(point: Point2D, vertices: Point2D[]): boolean {
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

export function snapPointToGridNode(point: Point2D, settings: GridSnapSettings): Point2D {
  const nx = Math.max(2, settings.nx);
  const ny = Math.max(2, settings.ny);
  const dx = settings.width / (nx - 1);
  const dy = settings.height / (ny - 1);

  const i = clamp(Math.round(point.x / dx), 0, nx - 1);
  const j = clamp(Math.round(point.y / dy), 0, ny - 1);

  return {
    x: i * dx,
    y: j * dy,
  };
}

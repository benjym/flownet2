import fs from 'node:fs';
import path from 'node:path';
import { snapPointToGridNode } from '../src/math';

interface Point {
  x: number;
  y: number;
}

interface Preset {
  id: string;
  domain: { width: number; height: number };
  solver: { nx: number; ny: number };
  lines?: Array<{ vertices: Point[] }>;
  polygons?: Array<{ vertices: Point[]; regionType?: 'noflow' | 'void' | 'material' }>;
  standpipePoint?: Point;
}

const presetsPath = path.resolve(process.cwd(), 'public/example-presets.json');
const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8')) as Preset[];

function pointKey(point: Point): string {
  return `${point.x.toFixed(12)},${point.y.toFixed(12)}`;
}

describe('example presets', () => {
  it('stores every editable point on its preset grid', () => {
    const offGrid: string[] = [];

    presets.forEach((preset) => {
      const check = (label: string, point: Point): void => {
        const snapped = snapPointToGridNode(point, {
          width: preset.domain.width,
          height: preset.domain.height,
          nx: preset.solver.nx,
          ny: preset.solver.ny,
        });
        if (Math.abs(snapped.x - point.x) > 1e-10 || Math.abs(snapped.y - point.y) > 1e-10) {
          offGrid.push(`${preset.id} ${label}: (${point.x}, ${point.y})`);
        }
      };

      (preset.lines ?? []).forEach((line, lineIndex) => {
        line.vertices.forEach((point, pointIndex) => check(`line ${lineIndex + 1} point ${pointIndex + 1}`, point));
      });
      (preset.polygons ?? []).forEach((polygon, polygonIndex) => {
        polygon.vertices.forEach((point, pointIndex) => check(`polygon ${polygonIndex + 1} point ${pointIndex + 1}`, point));
      });
      if (preset.standpipePoint) {
        check('standpipe', preset.standpipePoint);
      }
    });

    expect(offGrid).toEqual([]);
  });

  it('does not contain collapsed lines or duplicate consecutive polygon vertices', () => {
    const invalidGeometry: string[] = [];

    presets.forEach((preset) => {
      (preset.lines ?? []).forEach((line, lineIndex) => {
        for (let index = 1; index < line.vertices.length; index += 1) {
          if (pointKey(line.vertices[index]) === pointKey(line.vertices[index - 1])) {
            invalidGeometry.push(`${preset.id} line ${lineIndex + 1} has a zero-length segment`);
          }
        }
      });

      (preset.polygons ?? []).forEach((polygon, polygonIndex) => {
        const uniqueVertices = new Set(polygon.vertices.map(pointKey));
        if (uniqueVertices.size < 3) {
          invalidGeometry.push(`${preset.id} polygon ${polygonIndex + 1} has fewer than 3 unique vertices`);
        }
        polygon.vertices.forEach((point, index) => {
          const nextPoint = polygon.vertices[(index + 1) % polygon.vertices.length];
          if (pointKey(point) === pointKey(nextPoint)) {
            invalidGeometry.push(`${preset.id} polygon ${polygonIndex + 1} has a zero-length edge`);
          }
        });
      });
    });

    expect(invalidGeometry).toEqual([]);
  });

  it('represents the drain as a closed, approximately circular low-head boundary', () => {
    const drain = presets.find((preset) => preset.id === 'drain');
    const drainBoundary = drain?.lines?.[1];

    expect(drainBoundary).toBeDefined();
    expect(drainBoundary?.vertices.length).toBeGreaterThanOrEqual(9);

    const vertices = drainBoundary?.vertices ?? [];
    expect(pointKey(vertices[0])).toBe(pointKey(vertices[vertices.length - 1]));

    const uniqueVertices = vertices.slice(0, -1);
    const xs = uniqueVertices.map((point) => point.x);
    const ys = uniqueVertices.map((point) => point.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    const gridTolerance = drain ? Math.max(
      drain.domain.width / (drain.solver.nx - 1),
      drain.domain.height / (drain.solver.ny - 1),
    ) : 0;

    expect(Math.abs(width - height)).toBeLessThanOrEqual(gridTolerance);
  });

  it('places a matching void directly beneath the drain boundary', () => {
    const drain = presets.find((preset) => preset.id === 'drain');
    const drainBoundaryVertices = drain?.lines?.[1]?.vertices ?? [];
    const drainVoid = drain?.polygons?.find((polygon) => polygon.regionType === 'void');

    expect(drainVoid).toBeDefined();
    expect(drainVoid?.vertices.map(pointKey)).toEqual(drainBoundaryVertices.slice(0, -1).map(pointKey));
  });
});

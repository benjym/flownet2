import {
  clamp,
  distance,
  pointInPolygon,
  projectPointToSegment,
  snapPointToGridNode,
  type GridSnapSettings,
} from '../src/math';

describe('math utilities', () => {
  it('clamps values within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(18, 0, 10)).toBe(10);
  });

  it('computes euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('projects point onto segment interior', () => {
    const projected = projectPointToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(projected.x).toBeCloseTo(3, 9);
    expect(projected.y).toBeCloseTo(0, 9);
  });

  it('projects point onto nearest endpoint when outside segment', () => {
    const projected = projectPointToSegment({ x: -4, y: 1 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(projected.x).toBeCloseTo(0, 9);
    expect(projected.y).toBeCloseTo(0, 9);
  });

  it('detects inside/outside points in polygon', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 12, y: 5 }, square)).toBe(false);
  });

  it('snaps to nearest grid node', () => {
    const settings: GridSnapSettings = { width: 30, height: 12, nx: 81, ny: 41 };
    const snapped = snapPointToGridNode({ x: 3.17, y: 2.91 }, settings);
    const dx = settings.width / (settings.nx - 1);
    const dy = settings.height / (settings.ny - 1);

    expect(Math.abs(snapped.x / dx - Math.round(snapped.x / dx))).toBeLessThan(1e-9);
    expect(Math.abs(snapped.y / dy - Math.round(snapped.y / dy))).toBeLessThan(1e-9);
  });

  it('snaps with lower-bound grid guards', () => {
    const snapped = snapPointToGridNode({ x: 4.6, y: 4.6 }, { width: 10, height: 10, nx: 1, ny: 1 });
    expect(snapped).toEqual({ x: 0, y: 0 });
  });
});

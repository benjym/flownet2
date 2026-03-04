# Flow Net Studio

Interactive Vite + TypeScript web app for teaching 2D anisotropic groundwater flow nets.

Students can:
- Draw boundary conditions (equipotential, phreatic, no-flow)
- Add impermeable zones
- Solve and visualize equipotential lines + flow lines
- Place a standpipe to read hydraulic head and rise
- Export a PNG of the current canvas

## Tech Stack

- Vite
- Vanilla TypeScript (no React)
- HTML Canvas rendering
- Playwright end-to-end tests

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run locally

```bash
npm run dev
```

Open the URL shown in terminal (usually `http://127.0.0.1:5173` or similar).

### 3. Build production bundle

```bash
npm run build
```

## Student Usage

1. Start with default boundaries or load a preset from **Examples**.
2. Use drawing tools:
- `EP line`: fixed hydraulic head
- `Phreatic`: fixed head equal to elevation
- `No-flow line`: impermeable barrier
- `No-flow zone`: impermeable rectangular zone
- `Standpipe`: click to read head and water rise
3. Keep **Auto-solve** on, or click **Solve now**.
4. Use **Boundary List** to select/edit items.
5. Click **Download PNG** to save the visualization.

## Precision Controls (Desktop + Mobile)

Canvas toolbar controls:
- `+` / `-`: zoom in/out
- `Pan`: toggle drag-to-pan mode
- `Fit`: reset to full-domain view

Keyboard shortcuts:
- `Esc`: cancel in-progress drawing (and exit pan mode)
- `Delete` / `Backspace`: remove selected boundary/zone

## URL Parameters

Load a preset directly:

```text
?example=<preset-id>
```

Available preset ids:
- `uniform-ep`
- `earth-dam`
- `cutoff-wall`
- `drain`
- `sheet-pile`
- `anisotropic-demo`

Examples:
- `/?example=earth-dam`
- `/?example=cutoff-wall`
- `/?example=drain`

## Testing

Run end-to-end tests:

```bash
npm run test:e2e
```

Current suite covers:
- Student draw/solve/probe/export flow
- Guidance and keyboard behavior
- Mobile layout behavior
- Zoom/pan behavior
- URL-based preset loading and preset switching

## Notes

- Solver is a structured-grid finite-difference model with SOR iteration.
- Outer boundary is no-flow unless explicitly overridden by drawn EP/phreatic lines.
- This is an educational tool designed for first-time undergraduate flow-net learning.

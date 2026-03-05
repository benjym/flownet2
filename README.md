# Flow Net Studio

Interactive Vite + TypeScript web app for teaching 2D anisotropic groundwater flow nets.

Students can:
- Draw boundary conditions (equipotential, phreatic, no-flow)
- Add impermeable no-flow polygons
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

Open the URL shown in terminal (usually `http://127.0.0.1:5180` or similar).

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
- `No-flow polygon`: impermeable area (draw initial shape, then edit vertices)
- `Standpipe`: click to read head and water rise
3. In `Select`, edit polygons:
- Drag polygon vertices to reshape
- `Alt` + click edge to insert a vertex
- `Ctrl`/`Cmd` + click a vertex to delete it (minimum 3 kept)
  - Cursor shows `+`/`-` cues for add/remove while modifier keys are held
4. Keep **Auto-solve** on, or click **Solve now**.
5. Use **Boundary List** to select/edit items.
6. Click **Download PNG** to save the visualization.
7. Use **Save state** to export your current model as JSON.
8. Use **Load file** (or drag/drop a JSON file onto the page) to restore a saved model.

When anisotropy is active (`Kx != Ky`), use **Coordinates** in Solver + Display to toggle between:
- `Real (x, y)`
- `Transformed (x', y')` where `x' = x*sqrt(Ky/Kx)` and `y' = y`

## Precision Controls (Desktop + Mobile)

Canvas toolbar controls:
- Mouse wheel / trackpad pinch: zoom in/out
- Drag empty canvas space in `Select`: pan view
- Fit-to-screen button: reset to full-domain view

Keyboard shortcuts:
- `Esc`: cancel in-progress drawing
- `Delete` / `Backspace`: remove selected boundary/polygon

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

## CI/CD: GitHub Pages

This repo includes a GitHub Actions workflow at:

- `.github/workflows/ci-cd-pages.yml`

What it does:

1. On every push to `main` and every pull request:
- Installs dependencies
- Builds the app
- Runs Playwright E2E tests
2. On pushes to `main` only:
- Builds with the correct GitHub Pages base path
- Publishes `dist/` to GitHub Pages

### One-time GitHub setup

In your repository settings:

1. Go to **Settings -> Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

After that, every successful push to `main` will auto-deploy.

## Notes

- Solver is a structured-grid finite-difference model with SOR iteration.
- Outer boundary is no-flow unless explicitly overridden by drawn EP/phreatic lines.
- This is an educational tool designed for first-time undergraduate flow-net learning.

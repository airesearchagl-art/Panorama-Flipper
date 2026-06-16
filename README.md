# Panorama Flipper

A browser-based tool to flip 360° equirectangular panorama images horizontally — directly in the image file, not just in a viewer setting.

## Why

Renderers such as D5 Render, Twinmotion, Lumion, Enscape, and SketchUp-based pipelines sometimes export 360° panoramas with reversed orientation (mirrored left/right). Fixing this at the viewer level isn't always possible or portable. Panorama Flipper bakes the horizontal flip into the image itself, so the corrected file works consistently across any panorama viewer.

## Features

- Load images via file picker or drag & drop
- Supports PNG, JPG/JPEG, and WebP
- Horizontal flip rendered with Canvas, preserving original dimensions and quality
- Side-by-side (or stacked on narrow screens) Original vs Flipped comparison
- Image info panel: file name, dimensions, aspect ratio, 2:1 panorama detection, file type
- Download flipped result as PNG or JPG (JPEG quality 0.92)
- Reset to start over
- 100% client-side — no image is ever uploaded to a server

## Usage

1. Open the app (locally or via a deployed URL).
2. Drop a panorama image onto the drop area, or click "choose file".
3. Review the detected image info (dimensions, aspect ratio, panorama likelihood).
4. Click **Flip Horizontal** to generate the flipped version.
5. Compare Original vs Flipped previews.
6. Click **Download PNG** or **Download JPG** to save the result.
7. Click **Reset** to clear and start over with a new image.

## Running locally

No build step or dependencies are required.

```bash
git clone https://github.com/airesearchagl-art/Panorama-Flipper.git
cd Panorama-Flipper
```

Then simply open `index.html` in a browser, or serve the folder with any static file server, e.g.:

```bash
python3 -m http.server 8000
```

and visit `http://localhost:8000`.

## Deployment

### GitHub Pages

1. Push this repository to GitHub.
2. In repository Settings → Pages, set the source to the `main` branch (root).
3. The app will be served at `https://<user>.github.io/Panorama-Flipper/`.

### Vercel

1. Import the repository in Vercel.
2. Framework preset: "Other" (static site, no build command needed).
3. Output directory: repository root.
4. Deploy.

## Privacy

All image processing happens locally in your browser using the Canvas API. Images are never uploaded to any server or third-party service.

## Future extensions

- Batch flipping of multiple images at once
- Vertical (top-bottom) flip
- 90° / 180° rotation
- EXIF / metadata preservation
- Image compression options
- Before/after slider comparison

## License

MIT License — see [LICENSE](LICENSE).

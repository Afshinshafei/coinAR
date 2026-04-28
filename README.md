# Coin Hunt AR

Simple WebXR coin hunt for phones. Coins spawn on detected surfaces in front of you (hit testing). Walk close to collect them. Built with [three.js](https://threejs.org/) and static files suitable for [GitHub Pages](https://pages.github.com/).

## Try it

Use **Chrome on an Android phone** with **ARCore**. Open the site over **HTTPS** (GitHub Pages provides this). Tap **Start AR**, allow permissions, then move toward floating coins.

## Deploy on GitHub Pages

This repo includes a **GitHub Actions** workflow (`.github/workflows/deploy-pages.yml`) that publishes the site on every push to `main`.

1. Push the `main` branch to GitHub.
2. Open **Settings → Pages** for the repository. Under **Build and deployment**, set **Source** to **GitHub Actions** (not "Deploy from a branch", unless you prefer that method instead).
3. After the workflow runs, the app URL will be either:
   - **Project site:** `https://<username>.github.io/<repository>/`
   - **User site:** `https://<username>.github.io/` (only if this repo is named `<username>.github.io`)

### Base path and assets

- **Project site** (`...github.io/repoName/`): this project uses `import.meta.url` for the GLB and relative links for CSS and the script, so requests resolve under the same folder as `main.js` (for example `.../repoName/coind3d.glb`). No extra `base` tag is required as long as you open the app at the Pages URL (not a deep copy of only `index.html` elsewhere).
- If you ever host under a **different subpath** or a CDN that rewrites URLs, adjust `COIN_MODEL_URL` in `main.js` or add a `<base href="https://<username>.github.io/<repository>/">` in `index.html` and keep asset paths consistent.

## Local preview note

WebXR immersive AR usually needs a real device and HTTPS. Opening `index.html` from the file system will not load modules or XR correctly; use a small static server over HTTPS or rely on GitHub Pages for testing.

## Browser support

Immersive AR with hit testing is most reliable on **Android Chrome**. Other browsers may not expose `immersive-ar` or `hit-test`.

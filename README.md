# Coin Hunt AR

Simple WebXR coin hunt for phones. Coins spawn on detected surfaces in front of you (hit testing). Walk close to collect them. Built with [three.js](https://threejs.org/) and static files suitable for [GitHub Pages](https://pages.github.com/).

## Try it

### iPhone (Safari)

This repo targets **iPhone Safari** with **camera hunt** mode (not WebXR world tracking, which is still unreliable for immersive AR on iOS). Open the **https://** GitHub Pages URL in **Safari** (not inside Instagram or Facebook). Tap **Start hunt**, allow **Motion and Orientation** and **Camera**, then **aim the reticle** at floating coins to collect them. Tap **End hunt** to stop the camera and return to the menu.

### Android (Chrome)

If the browser reports **WebXR immersive-ar**, the app uses **WebXR** with hit testing so coins anchor on surfaces; walk near them to collect. Otherwise it falls back to the same **camera hunt** mode as on iPhone.

### Secure context (everyone)

Camera, motion, and WebXR need a **[secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)**:

1. **Not HTTPS** – Plain `http://` (including LAN dev URLs) blocks these APIs. Use your **GitHub Pages** `https://<user>.github.io/<repo>/` link.
2. **file://** – Will not run correctly. Deploy to GitHub Pages or use HTTPS locally.
3. **In-app browsers** – Often block camera or motion. Use **Open in Safari** or **Open in Chrome**.

More background: [Immersive Web](https://immersiveweb.dev/) and [three.js WebXR](https://threejs.org/docs/#manual/en/introduction/WebXR-and-three.js).

## Deploy on GitHub Pages

Static files live at the repo root (`index.html`, `main.js`, `styles.css`, `coind3d.glb`). Use **Deploy from a branch** (no build step required).

1. On GitHub: **Settings → Pages** for this repository.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main** and folder **/ (root)**, then save.
4. After a minute, the site is available at `https://<your-username>.github.io/<repository>/` for a project site.

For a **user/org site** instead (`https://<username>.github.io/` only), the repo must be named `<username>.github.io`.

### Base path and assets

- **Project site** (`...github.io/repoName/`): this project uses `import.meta.url` for the GLB and relative links for CSS and the script, so requests resolve under the same folder as `main.js` (for example `.../repoName/coind3d.glb`). No extra `base` tag is required as long as you open the app at the Pages URL (not a deep copy of only `index.html` elsewhere).
- If you ever host under a **different subpath** or a CDN that rewrites URLs, adjust `COIN_MODEL_URL` in `main.js` or add a `<base href="https://<username>.github.io/<repository>/">` in `index.html` and keep asset paths consistent.

## Local preview note

WebXR immersive AR usually needs a real device and HTTPS. Opening `index.html` from the file system will not load modules or XR correctly; use a small static server over HTTPS or rely on GitHub Pages for testing.

## Browser support

Immersive AR with hit testing is most reliable on **Android Chrome**. Other browsers may not expose `immersive-ar` or `hit-test`.

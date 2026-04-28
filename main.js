import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const COIN_MODEL_URL = new URL('./coind3d.glb', import.meta.url).href;
const COIN_UNIFORM_SCALE = 0.12;
const SURFACE_OFFSET_M = 0.16;
const MAX_ACTIVE_COINS = 14;
const SPAWN_INTERVAL_MS = 2200;
const COLLECT_DISTANCE_M = 0.34;
const COLLECT_RAY_TO_POINT_M = 0.36;
const COLLECT_MAX_RANGE_M = 5.5;
const BOB_AMPLITUDE_M = 0.025;
const BOB_SPEED = 2.2;

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const statusEl = document.getElementById('status');
const statusExtraEl = document.getElementById('status-extra');
const hintMain = document.getElementById('hint-main');
const preAr = document.getElementById('pre-ar');
const overlayRoot = document.getElementById('dom-overlay-root');
const coinCountEl = document.getElementById('coin-count');
const videoEl = document.getElementById('cam-feed');

let collected = 0;
/** @type {'idle' | 'webxr' | 'iphone'} */
let activeMode = 'idle';
/** @type {'webxr' | 'camera'} */
let startKind = 'camera';

let mediaStream = null;
let onDeviceOrientation = null;

const raycaster = new THREE.Raycaster();
const pCenter = new THREE.Vector2(0, 0);

function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * WebXR HUD canvas colors (keep aligned with :root in styles.css)
 */
const HUD = {
  bg: 'rgba(15, 20, 25, 0.78)',
  border: 'rgba(255, 255, 255, 0.1)',
  label: '#8b9aac',
  accent: '#6ee7b7',
};

function setStatus(text, variant = 'warn') {
  statusEl.textContent = text || '';
  statusEl.className = 'status' + (text ? ` status--${variant}` : '');
}

function clearStatusExtra() {
  statusExtraEl.replaceChildren();
  statusExtraEl.className = 'status-extra';
}

/** Plain-text secondary line. Use showHttpsReloadHint for the HTTPS link UI. */
function setStatusExtra(text, variant = 'muted') {
  clearStatusExtra();
  if (!text) return;
  statusExtraEl.textContent = text;
  statusExtraEl.className = `status-extra status-extra--${variant}`;
}

function showHttpsReloadHint() {
  clearStatusExtra();
  const line = document.createElement('span');
  line.appendChild(document.createTextNode('Open the same address with '));
  const a = document.createElement('a');
  a.href = document.location.href.replace(/^http:/i, 'https:');
  a.textContent = 'https://';
  line.appendChild(a);
  line.appendChild(document.createTextNode(' so camera and motion APIs work.'));
  statusExtraEl.appendChild(line);
  statusExtraEl.className = 'status-extra status-extra--muted';
}

function setPreArLoading(on) {
  preAr.classList.toggle('pre-ar--loading', Boolean(on));
}

function updateCounterDisplay() {
  coinCountEl.textContent = String(collected);
}

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 80);
camera.position.set(0, 1.55, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
try {
  renderer.xr.setReferenceSpaceType('local-floor');
} catch {
  try {
    renderer.xr.setReferenceSpaceType('local');
  } catch {
    try {
      renderer.xr.setReferenceSpaceType('viewer');
    } catch {
      /* ignore */
    }
  }
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 1);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.55);
dir.position.set(1, 2, 1);
scene.add(dir);

const loader = new GLTFLoader();
let coinTemplate = null;

const coins = [];
const tmpVec = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const tmpMat = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const viewerWorldPos = new THREE.Vector3();
const orientEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const screenOrientQuat = new THREE.Quaternion();
const zAxis = new THREE.Vector3(0, 0, 1);

let xrSession = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let referenceSpace = null;
let spawnAccumMs = 0;
let lastFrameTimeMs = 0;
let useDomOverlay = false;

let hudMesh = null;
let hudCanvas = null;
let hudCtx = null;
let hudTexture = null;

function buildHudFallback() {
  hudCanvas = document.createElement('canvas');
  hudCanvas.width = 512;
  hudCanvas.height = 128;
  hudCtx = hudCanvas.getContext('2d');
  hudTexture = new THREE.CanvasTexture(hudCanvas);
  hudTexture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: hudTexture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const geo = new THREE.PlaneGeometry(0.55, 0.14);
  hudMesh = new THREE.Mesh(geo, mat);
  hudMesh.position.set(0, 0.05, -0.55);
  hudMesh.renderOrder = 999;
}

function drawHudFallback() {
  if (!hudCtx || !hudTexture) return;
  const ctx = hudCtx;
  const w = hudCanvas.width;
  const h = hudCanvas.height;
  const pad = 8;
  const rw = w - pad * 2;
  const rh = h - pad * 2;
  const r = rh / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(pad, pad, rw, rh, r);
  } else {
    ctx.rect(pad, pad, rw, rh);
  }
  ctx.fillStyle = HUD.bg;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = HUD.border;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = HUD.label;
  ctx.font = '600 26px system-ui,sans-serif';
  ctx.fillText('COINS', 36, 54);
  ctx.fillStyle = HUD.accent;
  ctx.font = '800 46px system-ui,sans-serif';
  ctx.fillText(String(collected), 36, 104);
  hudTexture.needsUpdate = true;
}

function ensureHudFallback() {
  if (!hudMesh) buildHudFallback();
  drawHudFallback();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

function disposeCoin(entry) {
  scene.remove(entry.root);
  entry.root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

function collectCoin(entry) {
  const idx = coins.indexOf(entry);
  if (idx === -1) return;
  coins.splice(idx, 1);
  collected += 1;
  updateCounterDisplay();
  if (!useDomOverlay) drawHudFallback();
  if (navigator.vibrate) navigator.vibrate(28);
  disposeCoin(entry);
}

function trySpawnFromHit(frame) {
  if (!hitTestSource || !referenceSpace || coins.length >= MAX_ACTIVE_COINS) return;
  const results = frame.getHitTestResults(hitTestSource);
  if (!results || results.length === 0) return;

  const hit = results[0];
  const pose = hit.getPose(referenceSpace);
  if (!pose) return;

  tmpMat.fromArray(pose.transform.matrix);
  tmpMat.decompose(tmpPos, tmpQuat, tmpScale);

  tmpNormal.set(0, 1, 0).applyQuaternion(tmpQuat).normalize();
  tmpPos.addScaledVector(tmpNormal, SURFACE_OFFSET_M);

  const root = new THREE.Group();
  root.position.copy(tmpPos);
  root.quaternion.copy(tmpQuat);

  const model = coinTemplate.clone(true);
  model.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = false;
      c.receiveShadow = false;
    }
  });
  model.scale.setScalar(COIN_UNIFORM_SCALE);
  root.add(model);

  root.userData.bobPhase = Math.random() * Math.PI * 2;
  root.userData.baseY = root.position.y;

  scene.add(root);
  coins.push({ root, model });
}

function spawnCoinPhoneMode() {
  if (!coinTemplate || coins.length >= MAX_ACTIVE_COINS) return;

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const worldUp = new THREE.Vector3(0, 1, 0);
  let right = new THREE.Vector3().crossVectors(forward, worldUp);
  if (right.lengthSq() < 1e-8) {
    right = new THREE.Vector3(1, 0, 0);
  } else {
    right.normalize();
  }
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();

  const spread = 0.62;
  const dir = forward
    .clone()
    .addScaledVector(right, (Math.random() - 0.5) * 2 * spread)
    .addScaledVector(up, (Math.random() - 0.5) * 2 * spread)
    .normalize();

  const dist = 1.75 + Math.random() * 1.35;
  const pos = camera.position.clone().addScaledVector(dir, dist);

  const root = new THREE.Group();
  root.position.copy(pos);
  root.quaternion.copy(camera.quaternion);

  const model = coinTemplate.clone(true);
  model.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = false;
      c.receiveShadow = false;
    }
  });
  model.scale.setScalar(COIN_UNIFORM_SCALE);
  root.add(model);

  root.userData.bobPhase = Math.random() * Math.PI * 2;
  root.userData.baseY = root.position.y;

  scene.add(root);
  coins.push({ root, model });
}

function updateCoinsWebXR(timeSec, viewerPos) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const { root } = coins[i];
    const phase = root.userData.bobPhase;
    const bob = Math.sin(timeSec * BOB_SPEED + phase) * BOB_AMPLITUDE_M;
    root.position.y = root.userData.baseY + bob;

    root.getWorldPosition(tmpVec);
    if (tmpVec.distanceTo(viewerPos) < COLLECT_DISTANCE_M) {
      collectCoin(coins[i]);
    }
  }
}

function updateCoinsPhoneMode(timeSec) {
  raycaster.setFromCamera(pCenter, camera);

  for (let i = coins.length - 1; i >= 0; i--) {
    const { root } = coins[i];
    const phase = root.userData.bobPhase;
    const bob = Math.sin(timeSec * BOB_SPEED + phase) * BOB_AMPLITUDE_M;
    root.position.y = root.userData.baseY + bob;

    root.getWorldPosition(tmpVec);
    const range = tmpVec.distanceTo(camera.position);
    const rayDist = raycaster.ray.distanceToPoint(tmpVec);
    if (range < COLLECT_MAX_RANGE_M && rayDist < COLLECT_RAY_TO_POINT_M) {
      collectCoin(coins[i]);
    }
  }
}

function getViewerWorldPosition(frame) {
  const pose = frame.getViewerPose(referenceSpace);
  if (!pose) return null;
  tmpMat.fromArray(pose.transform.matrix);
  tmpMat.decompose(viewerWorldPos, tmpQuat, tmpScale);
  return viewerWorldPos;
}

renderer.setAnimationLoop((timeMs, frame) => {
  if (activeMode === 'iphone') {
    const deltaMs = lastFrameTimeMs ? timeMs - lastFrameTimeMs : 16;
    lastFrameTimeMs = timeMs;
    const timeSec = timeMs / 1000;
    spawnAccumMs += deltaMs;
    if (spawnAccumMs >= SPAWN_INTERVAL_MS) {
      spawnAccumMs = 0;
      spawnCoinPhoneMode();
    }
    updateCoinsPhoneMode(timeSec);
    renderer.render(scene, camera);
    return;
  }

  if (activeMode === 'webxr' && frame && referenceSpace) {
    const deltaMs = lastFrameTimeMs ? timeMs - lastFrameTimeMs : 16;
    lastFrameTimeMs = timeMs;
    const timeSec = timeMs / 1000;

    if (!hitTestSourceRequested && xrSession) {
      hitTestSourceRequested = true;
      xrSession.requestReferenceSpace('viewer').then((viewerSpace) => {
        xrSession.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
        }).catch(() => {
          setStatus('Hit test unavailable on this device.', 'warn');
        });
      }).catch(() => {
        setStatus('Could not create viewer space for hit test.', 'warn');
      });
    }

    const viewerPos = getViewerWorldPosition(frame);
    if (viewerPos) {
      spawnAccumMs += deltaMs;
      if (spawnAccumMs >= SPAWN_INTERVAL_MS) {
        spawnAccumMs = 0;
        trySpawnFromHit(frame);
      }
      updateCoinsWebXR(timeSec, viewerPos);
    }

    renderer.render(scene, camera);
    return;
  }

  renderer.render(scene, camera);
});

renderer.xr.addEventListener('sessionstart', () => {
  document.body.classList.add('xr-active');
  lastFrameTimeMs = 0;
  spawnAccumMs = SPAWN_INTERVAL_MS;
  btnStop.hidden = true;
  if (!useDomOverlay) {
    ensureHudFallback();
    const xrCam = renderer.xr.getCamera();
    if (hudMesh && xrCam && !hudMesh.parent) xrCam.add(hudMesh);
  }
});

renderer.xr.addEventListener('sessionend', () => {
  activeMode = 'idle';
  document.body.classList.remove('xr-active');
  xrSession = null;
  hitTestSource = null;
  hitTestSourceRequested = false;
  referenceSpace = null;
  spawnAccumMs = 0;
  lastFrameTimeMs = 0;
  while (coins.length) {
    const c = coins.pop();
    disposeCoin(c);
  }
  if (hudMesh && hudMesh.parent) hudMesh.parent.remove(hudMesh);
  preAr.hidden = false;
  overlayRoot.hidden = true;
  btnStart.disabled = false;
  btnStop.hidden = true;
  setStatus('');
  clearStatusExtra();
  if (navigator.xr?.offerSession) {
    const offerInit = {
      requiredFeatures: [],
      optionalFeatures: ['local-floor', 'hit-test', 'dom-overlay'],
      domOverlay: { root: overlayRoot },
    };
    navigator.xr.offerSession('immersive-ar', offerInit).catch(() => {});
  }
});

async function requestReferenceSpace(session) {
  try {
    return await session.requestReferenceSpace('local-floor');
  } catch {
    try {
      return await session.requestReferenceSpace('local');
    } catch {
      return await session.requestReferenceSpace('viewer');
    }
  }
}

async function startWebXRSession() {
  if (!navigator.xr) {
    setStatus('WebXR is not exposed in this context.', 'error');
    return;
  }

  let supported = false;
  try {
    supported = await navigator.xr.isSessionSupported('immersive-ar');
  } catch (e) {
    setStatus('Could not query AR support.', 'error');
    setStatusExtra(e?.message || String(e), 'error');
    return;
  }

  if (!supported) {
    setStatus('immersive-ar is not supported here.', 'warn');
    return;
  }

  useDomOverlay = false;
  let session = null;
  let lastErr = null;

  const attempts = [
    {
      requiredFeatures: [],
      optionalFeatures: ['local-floor', 'hit-test', 'dom-overlay'],
      domOverlay: { root: overlayRoot },
    },
    {
      requiredFeatures: [],
      optionalFeatures: ['local-floor', 'hit-test'],
    },
    {
      requiredFeatures: [],
      optionalFeatures: ['hit-test', 'dom-overlay'],
      domOverlay: { root: overlayRoot },
    },
    {
      requiredFeatures: [],
      optionalFeatures: ['local-floor', 'dom-overlay'],
      domOverlay: { root: overlayRoot },
    },
    {
      requiredFeatures: [],
      optionalFeatures: ['local-floor'],
    },
  ];

  for (const init of attempts) {
    try {
      session = await navigator.xr.requestSession('immersive-ar', init);
      break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!session) {
    setStatus('Could not start an AR session.', 'error');
    setStatusExtra(lastErr?.message || String(lastErr), 'error');
    return;
  }

  if (session.domOverlayState && session.domOverlayState.type) {
    useDomOverlay = true;
  }

  referenceSpace = await requestReferenceSpace(session);
  xrSession = session;
  hitTestSourceRequested = false;

  overlayRoot.hidden = !useDomOverlay;
  preAr.hidden = true;
  btnStart.disabled = true;
  updateCounterDisplay();

  activeMode = 'webxr';
  try {
    await renderer.xr.setSession(session);
  } catch (e) {
    activeMode = 'idle';
    referenceSpace = null;
    xrSession = null;
    hitTestSourceRequested = false;
    preAr.hidden = false;
    overlayRoot.hidden = true;
    btnStart.disabled = false;
    throw e;
  }

  session.addEventListener(
    'end',
    () => {
      renderer.xr.setSession(null);
    },
    { once: true },
  );
}

function detachDeviceOrientation() {
  if (onDeviceOrientation) {
    window.removeEventListener('deviceorientation', onDeviceOrientation, true);
    onDeviceOrientation = null;
  }
}

function stopMedia() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  videoEl.srcObject = null;
}

function stopPhoneHunt() {
  activeMode = 'idle';
  lastFrameTimeMs = 0;
  spawnAccumMs = 0;
  detachDeviceOrientation();
  stopMedia();
  document.body.classList.remove('ios-hunt-active');
  while (coins.length) {
    const c = coins.pop();
    disposeCoin(c);
  }
  preAr.hidden = false;
  overlayRoot.hidden = true;
  btnStart.disabled = false;
  btnStop.hidden = true;
  useDomOverlay = false;
  setStatus('');
  clearStatusExtra();
}

async function startPhoneHunt() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Camera API not available.', 'error');
    return;
  }

  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm !== 'granted') {
        setStatus('Motion access was denied.', 'error');
        setStatusExtra('Enable motion in Safari settings or try again and tap Allow.', 'muted');
        return;
      }
    } catch (e) {
      setStatus('Could not request motion permission.', 'error');
      setStatusExtra(e?.message || String(e), 'error');
      return;
    }
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch (e) {
    setStatus('Camera was blocked or unavailable.', 'error');
    setStatusExtra(e?.message || String(e), 'error');
    return;
  }

  videoEl.srcObject = mediaStream;
  try {
    await videoEl.play();
  } catch (e) {
    stopMedia();
    setStatus('Could not start the camera preview.', 'error');
    setStatusExtra(e?.message || String(e), 'error');
    return;
  }

  onDeviceOrientation = (ev) => {
    if (ev.alpha == null || ev.beta == null || ev.gamma == null) return;
    const alpha = THREE.MathUtils.degToRad(ev.alpha);
    const beta = THREE.MathUtils.degToRad(ev.beta);
    const gamma = THREE.MathUtils.degToRad(ev.gamma);
    orientEuler.set(beta, alpha, -gamma, 'YXZ');
    camera.quaternion.setFromEuler(orientEuler);
    const angle = THREE.MathUtils.degToRad(window.screen?.orientation?.angle ?? 0);
    screenOrientQuat.setFromAxisAngle(zAxis, -angle);
    camera.quaternion.multiply(screenOrientQuat);
  };
  window.addEventListener('deviceorientation', onDeviceOrientation, true);

  collected = 0;
  updateCounterDisplay();
  useDomOverlay = true;
  activeMode = 'iphone';
  spawnAccumMs = SPAWN_INTERVAL_MS;
  lastFrameTimeMs = 0;
  document.body.classList.add('ios-hunt-active');
  preAr.hidden = true;
  overlayRoot.hidden = false;
  btnStop.hidden = false;
  btnStart.disabled = true;
  setStatus('');
  clearStatusExtra();
}

async function onStartClick() {
  try {
    if (startKind === 'webxr') {
      await startWebXRSession();
    } else {
      await startPhoneHunt();
    }
  } catch (e) {
    setStatus('Could not start.', 'error');
    setStatusExtra(e?.message || String(e), 'error');
    btnStart.disabled = false;
  }
}

async function init() {
  clearStatusExtra();
  btnStart.disabled = true;
  btnStop.hidden = true;

  const ios = isIOS();

  if (ios) {
    hintMain.innerHTML =
      'Designed for <strong>iPhone Safari</strong>. Tap Start hunt, allow <strong>Motion</strong> and <strong>Camera</strong>, then point the reticle at floating coins to collect them. Use the real GitHub Pages <code>https://</code> link (not an in-app browser).';
    startKind = 'camera';
  } else {
    hintMain.innerHTML =
      'On <strong>Android Chrome</strong>, WebXR places coins on surfaces. On other devices, camera hunt mode is used when WebXR is missing. Always use <strong>https://</strong>.';
    startKind = 'camera';
  }

  if (!window.isSecureContext) {
    setPreArLoading(false);
    setStatus('This page must be served over HTTPS (or localhost).', 'error');
    showHttpsReloadHint();
    return;
  }

  try {
    const gltf = await loader.loadAsync(COIN_MODEL_URL);
    coinTemplate = gltf.scene;
    const box = new THREE.Box3().setFromObject(coinTemplate);
    const center = box.getCenter(new THREE.Vector3());
    coinTemplate.position.sub(center);
  } catch (e) {
    setPreArLoading(false);
    setStatus(`Failed to load coin model: ${e.message || e}`, 'error');
    return;
  }

  if (!ios && 'xr' in navigator && navigator.xr) {
    try {
      if (await navigator.xr.isSessionSupported('immersive-ar')) {
        startKind = 'webxr';
      }
    } catch {
      startKind = 'camera';
    }
  }

  if (startKind === 'webxr') {
    setStatus('');
    clearStatusExtra();
  } else if (!navigator.mediaDevices?.getUserMedia) {
    setPreArLoading(false);
    setStatus('Camera mode needs getUserMedia.', 'warn');
    setStatusExtra(
      ios ? 'Open this page in Safari over HTTPS.' : 'Use a secure https:// URL or a recent browser.',
      'muted',
    );
    return;
  } else {
    setStatus('');
    clearStatusExtra();
    if (!ios) {
      setStatusExtra('WebXR immersive AR was not advertised on this browser. Using camera hunt mode instead.', 'muted');
    }
  }

  setPreArLoading(false);
  btnStart.disabled = false;
  btnStart.addEventListener('click', () => {
    onStartClick();
  });

  btnStop.addEventListener('click', () => {
    stopPhoneHunt();
  });
}

init();

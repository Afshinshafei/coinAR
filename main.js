import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const COIN_MODEL_URL = new URL('./coind3d.glb', import.meta.url).href;
const COIN_UNIFORM_SCALE = 0.12;
const SURFACE_OFFSET_M = 0.16;
const MAX_ACTIVE_COINS = 16;
const SPAWN_INTERVAL_MS = 2000;
const COLLECT_DISTANCE_M = 0.34;
const BOB_AMPLITUDE_M = 0.025;
const BOB_SPEED = 2.2;

const btnStart = document.getElementById('btn-start');
const statusEl = document.getElementById('status');
const preAr = document.getElementById('pre-ar');
const overlayRoot = document.getElementById('dom-overlay-root');
const coinCountEl = document.getElementById('coin-count');

let collected = 0;

function setStatus(text) {
  statusEl.textContent = text || '';
}

function updateCounterDisplay() {
  coinCountEl.textContent = String(collected);
}

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
camera.position.set(0, 1.6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 0.9);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.5);
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
  ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
  ctx.fillStyle = 'rgba(15,20,25,0.75)';
  ctx.fillRect(8, 8, hudCanvas.width - 16, hudCanvas.height - 16);
  ctx.fillStyle = '#9aa7b4';
  ctx.font = '600 28px system-ui,sans-serif';
  ctx.fillText('COINS', 32, 52);
  ctx.fillStyle = '#6ee7b7';
  ctx.font = '800 48px system-ui,sans-serif';
  ctx.fillText(String(collected), 32, 102);
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

function updateCoins(timeSec, viewerPos) {
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

function getViewerWorldPosition(frame) {
  const pose = frame.getViewerPose(referenceSpace);
  if (!pose) return null;
  tmpMat.fromArray(pose.transform.matrix);
  tmpMat.decompose(viewerWorldPos, tmpQuat, tmpScale);
  return viewerWorldPos;
}

renderer.setAnimationLoop((timeMs, frame) => {
  if (!frame || !referenceSpace) {
    renderer.render(scene, camera);
    return;
  }

  const deltaMs = lastFrameTimeMs ? timeMs - lastFrameTimeMs : 16;
  lastFrameTimeMs = timeMs;
  const timeSec = timeMs / 1000;

  if (!hitTestSourceRequested && xrSession) {
    hitTestSourceRequested = true;
    xrSession.requestReferenceSpace('viewer').then((viewerSpace) => {
      xrSession.requestHitTestSource({ space: viewerSpace }).then((source) => {
        hitTestSource = source;
      }).catch(() => {
        setStatus('Hit test unavailable on this device.');
      });
    }).catch(() => {
      setStatus('Could not create viewer space for hit test.');
    });
  }

  const viewerPos = getViewerWorldPosition(frame);
  if (viewerPos) {
    spawnAccumMs += deltaMs;
    if (spawnAccumMs >= SPAWN_INTERVAL_MS) {
      spawnAccumMs = 0;
      trySpawnFromHit(frame);
    }
    updateCoins(timeSec, viewerPos);
  }

  renderer.render(scene, camera);
});

renderer.xr.addEventListener('sessionstart', () => {
  lastFrameTimeMs = 0;
  spawnAccumMs = SPAWN_INTERVAL_MS;
  if (!useDomOverlay) {
    ensureHudFallback();
    const xrCam = renderer.xr.getCamera();
    if (hudMesh && xrCam && !hudMesh.parent) xrCam.add(hudMesh);
  }
});

renderer.xr.addEventListener('sessionend', () => {
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
  setStatus('');
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

async function startSession() {
  if (!navigator.xr) {
    setStatus('WebXR not supported in this browser.');
    return;
  }

  const ok = await navigator.xr.isSessionSupported('immersive-ar');
  if (!ok) {
    setStatus('immersive-ar not supported. Try Chrome on an ARCore phone.');
    return;
  }

  useDomOverlay = false;
  let session;

  const withOverlay = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['local-floor', 'dom-overlay'],
    domOverlay: { root: overlayRoot },
  };

  try {
    session = await navigator.xr.requestSession('immersive-ar', withOverlay);
    if (session.domOverlayState && session.domOverlayState.type) {
      useDomOverlay = true;
    }
  } catch {
    try {
      session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['local-floor'],
      });
    } catch (e2) {
      setStatus(`Could not start AR: ${e2.message || 'unknown error'}`);
      return;
    }
  }

  referenceSpace = await requestReferenceSpace(session);
  xrSession = session;
  hitTestSourceRequested = false;

  overlayRoot.hidden = !useDomOverlay;
  preAr.hidden = true;
  btnStart.disabled = true;
  updateCounterDisplay();

  await renderer.xr.setSession(session);

  session.addEventListener(
    'end',
    () => {
      renderer.xr.setSession(null);
    },
    { once: true },
  );
}

async function init() {
  if (!navigator.xr) {
    setStatus('WebXR not available.');
    return;
  }

  let arOk = false;
  try {
    arOk = await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    arOk = false;
  }
  if (arOk) {
    btnStart.disabled = false;
    setStatus('');
  } else {
    setStatus('AR session not supported here.');
  }

  try {
    const gltf = await loader.loadAsync(COIN_MODEL_URL);
    coinTemplate = gltf.scene;
    const box = new THREE.Box3().setFromObject(coinTemplate);
    const center = box.getCenter(new THREE.Vector3());
    coinTemplate.position.sub(center);
  } catch (e) {
    setStatus(`Failed to load coin model: ${e.message || e}`);
    btnStart.disabled = true;
    return;
  }

  btnStart.addEventListener('click', () => {
    startSession().catch((e) => {
      setStatus(e.message || String(e));
      btnStart.disabled = false;
    });
  });
}

init();

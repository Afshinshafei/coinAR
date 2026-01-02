// Coin Hunter AR - Game Logic

(function() {
    'use strict';

    // Game State
    const state = {
        score: 0,
        coins: [],
        isARActive: false,
        lastSpawnTime: 0,
        spawnInterval: 3000, // Spawn new coin every 3 seconds
        maxCoins: 5,
        collectionDistance: 0.5, // Distance to collect coin (meters)
        coinFloatHeight: 0.3 // Height above surface (meters)
    };

    // DOM Elements
    const startScreen = document.getElementById('start-screen');
    const startBtn = document.getElementById('start-btn');
    const gameUI = document.getElementById('game-ui');
    const scoreDisplay = document.getElementById('score');
    const messageEl = document.getElementById('message');
    const arScene = document.getElementById('ar-scene');
    const coinsContainer = document.getElementById('coins-container');
    const reticle = document.getElementById('reticle');
    const camera = document.getElementById('camera');

    // Hit test result storage
    let hitTestSource = null;
    let hitTestSourceRequested = false;
    let lastHitPose = null;

    // Initialize
    function init() {
        startBtn.addEventListener('click', startAR);
        
        // Listen for AR session events
        arScene.addEventListener('enter-vr', onEnterAR);
        arScene.addEventListener('exit-vr', onExitAR);
        
        // Set up hit test handling
        arScene.addEventListener('ar-hit-test-select', onHitTestSelect);
        arScene.addEventListener('ar-hit-test-start', onHitTestStart);
        
        console.log('Coin Hunter AR initialized');
    }

    // Start AR Session
    async function startAR() {
        // Check for WebXR support
        if (!navigator.xr) {
            showMessage('WebXR not supported on this device');
            return;
        }

        try {
            const supported = await navigator.xr.isSessionSupported('immersive-ar');
            if (!supported) {
                showMessage('AR not supported on this device');
                return;
            }
        } catch (e) {
            showMessage('Error checking AR support');
            return;
        }

        // Hide start screen and show AR scene
        startScreen.classList.add('hidden');
        arScene.classList.remove('hidden');
        gameUI.classList.remove('hidden');

        // Enter AR mode
        arScene.enterVR();
    }

    // AR Session Started
    function onEnterAR() {
        state.isARActive = true;
        showMessage('Point at the ground to place coins!');
        
        // Start the game loop
        requestAnimationFrame(gameLoop);
        
        // Spawn initial coins after a short delay
        setTimeout(() => {
            showMessage('Walk through coins to collect them!');
        }, 3000);
    }

    // AR Session Ended
    function onExitAR() {
        state.isARActive = false;
        startScreen.classList.remove('hidden');
        arScene.classList.add('hidden');
        gameUI.classList.add('hidden');
    }

    // Hit test started
    function onHitTestStart(event) {
        reticle.setAttribute('visible', true);
    }

    // Handle hit test select (user tapped on surface)
    function onHitTestSelect(event) {
        if (event.detail && event.detail.position) {
            spawnCoinAt(event.detail.position.x, event.detail.position.y + state.coinFloatHeight, event.detail.position.z);
        }
    }

    // Spawn a coin at position
    function spawnCoinAt(x, y, z) {
        if (state.coins.length >= state.maxCoins) {
            return;
        }

        const coinEntity = document.createElement('a-entity');
        coinEntity.setAttribute('gltf-model', '#coin-model');
        coinEntity.setAttribute('position', `${x} ${y} ${z}`);
        coinEntity.setAttribute('scale', '0.3 0.3 0.3');
        coinEntity.setAttribute('animation', {
            property: 'rotation',
            to: '0 360 0',
            loop: true,
            dur: 2000,
            easing: 'linear'
        });
        coinEntity.setAttribute('animation__float', {
            property: 'position',
            to: `${x} ${y + 0.1} ${z}`,
            dir: 'alternate',
            loop: true,
            dur: 1000,
            easing: 'easeInOutSine'
        });

        coinEntity.classList.add('coin');
        coinEntity.dataset.baseY = y;
        
        coinsContainer.appendChild(coinEntity);
        state.coins.push(coinEntity);
        
        // Spawn animation
        coinEntity.setAttribute('scale', '0 0 0');
        coinEntity.setAttribute('animation__spawn', {
            property: 'scale',
            from: '0 0 0',
            to: '0.3 0.3 0.3',
            dur: 300,
            easing: 'easeOutBack'
        });
    }

    // Spawn coins automatically at random positions around user
    function autoSpawnCoins() {
        if (state.coins.length >= state.maxCoins) return;
        
        const cameraPos = camera.object3D.position;
        const cameraWorldPos = new THREE.Vector3();
        camera.object3D.getWorldPosition(cameraWorldPos);
        
        // Random position 1-3 meters away from camera
        const angle = Math.random() * Math.PI * 2;
        const distance = 1 + Math.random() * 2;
        
        const x = cameraWorldPos.x + Math.cos(angle) * distance;
        const z = cameraWorldPos.z + Math.sin(angle) * distance;
        const y = 0.3 + Math.random() * 0.5; // Random height between 0.3 and 0.8 meters
        
        spawnCoinAt(x, y, z);
    }

    // Check if user collected any coins
    function checkCoinCollection() {
        const cameraWorldPos = new THREE.Vector3();
        camera.object3D.getWorldPosition(cameraWorldPos);
        
        for (let i = state.coins.length - 1; i >= 0; i--) {
            const coin = state.coins[i];
            const coinPos = coin.object3D.position;
            const coinWorldPos = new THREE.Vector3();
            coin.object3D.getWorldPosition(coinWorldPos);
            
            const distance = cameraWorldPos.distanceTo(coinWorldPos);
            
            if (distance < state.collectionDistance) {
                collectCoin(coin, i);
            }
        }
    }

    // Collect a coin
    function collectCoin(coinEntity, index) {
        // Remove from array
        state.coins.splice(index, 1);
        
        // Update score
        state.score++;
        updateScoreDisplay();
        
        // Collection animation
        coinEntity.setAttribute('animation__collect', {
            property: 'scale',
            to: '0 0 0',
            dur: 200,
            easing: 'easeInBack'
        });
        
        coinEntity.setAttribute('animation__fly', {
            property: 'position',
            to: `${coinEntity.object3D.position.x} ${coinEntity.object3D.position.y + 1} ${coinEntity.object3D.position.z}`,
            dur: 200,
            easing: 'easeOut'
        });
        
        // Remove after animation
        setTimeout(() => {
            if (coinEntity.parentNode) {
                coinEntity.parentNode.removeChild(coinEntity);
            }
        }, 250);
        
        // Show collection message
        if (state.score % 5 === 0) {
            showMessage(`Awesome! ${state.score} coins collected!`);
        }
    }

    // Update score display
    function updateScoreDisplay() {
        scoreDisplay.textContent = state.score;
        
        // Animate score
        scoreDisplay.style.transform = 'scale(1.3)';
        setTimeout(() => {
            scoreDisplay.style.transform = 'scale(1)';
        }, 150);
    }

    // Show message
    function showMessage(text, duration = 3000) {
        messageEl.textContent = text;
        messageEl.classList.add('show');
        
        setTimeout(() => {
            messageEl.classList.remove('show');
        }, duration);
    }

    // Main game loop
    function gameLoop(timestamp) {
        if (!state.isARActive) return;
        
        // Check coin collection
        checkCoinCollection();
        
        // Auto spawn coins periodically
        if (timestamp - state.lastSpawnTime > state.spawnInterval) {
            autoSpawnCoins();
            state.lastSpawnTime = timestamp;
        }
        
        requestAnimationFrame(gameLoop);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();


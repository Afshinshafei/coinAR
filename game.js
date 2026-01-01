// AR Coin Collector Game Logic - Using Three.js

class ARCoinGame {
    constructor() {
        this.score = 0;
        this.coins = [];
        this.gameState = 'menu';
        this.totalCoins = 8;
        this.cameraStream = null;
        
        // Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = null;
        this.mouse = new THREE.Vector2();
        this.clock = new THREE.Clock();
        this.coinModel = null;
        
        // Device orientation
        this.deviceOrientation = { alpha: 0, beta: 0, gamma: 0 };
        this.orientationEnabled = false;
        
        // DOM Elements
        this.startScreen = document.getElementById('startScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');
        this.startButton = document.getElementById('startButton');
        this.restartButton = document.getElementById('restartButton');
        this.scoreValue = document.getElementById('scoreValue');
        this.finalScore = document.getElementById('finalScore');
        this.arNotSupported = document.getElementById('arNotSupported');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.instructionsOverlay = document.getElementById('instructionsOverlay');
        this.cameraFeed = document.getElementById('cameraFeed');
        this.gameCanvas = document.getElementById('gameCanvas');
        this.coinsLeft = document.getElementById('coinsLeft');
        this.crosshair = document.getElementById('crosshair');
        
        this.init();
    }

    init() {
        this.checkARSupport();
        this.startButton.addEventListener('click', () => this.startGame());
        this.restartButton.addEventListener('click', () => this.restartGame());
    }

    checkARSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showARNotSupported();
        }
    }

    showARNotSupported() {
        this.arNotSupported.classList.remove('hidden');
        this.startButton.disabled = true;
        this.startButton.innerHTML = '<span class="btn-icon">&#10060;</span> Camera Not Available';
    }

    async startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.coins = [];
        this.updateScore();
        
        this.loadingIndicator.classList.remove('hidden');
        
        try {
            await this.initCamera();
            
            this.startScreen.classList.remove('active');
            this.gameScreen.classList.add('active');
            
            await this.initThreeJS();
            await this.loadCoinModel();
            this.spawnCoins();
            this.setupControls();
            this.animate();
            
            this.loadingIndicator.classList.add('hidden');
            
            // Hide instructions after delay
            setTimeout(() => {
                if (this.instructionsOverlay) {
                    this.instructionsOverlay.classList.add('fade-out');
                }
            }, 4000);
            
        } catch (error) {
            console.error('Failed to start game:', error);
            this.loadingIndicator.classList.add('hidden');
            this.showARNotSupported();
        }
    }

    async initCamera() {
        const constraints = {
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
            // Fallback to any camera
            this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        
        this.cameraFeed.srcObject = this.cameraStream;
        
        return new Promise((resolve, reject) => {
            this.cameraFeed.onloadedmetadata = () => {
                this.cameraFeed.play()
                    .then(resolve)
                    .catch(reject);
            };
            this.cameraFeed.onerror = reject;
        });
    }

    async initThreeJS() {
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 0);
        
        // Create renderer with transparency
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.gameCanvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0); // Fully transparent
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);
        
        const goldLight = new THREE.PointLight(0xffd700, 0.5, 20);
        goldLight.position.set(0, 2, 0);
        this.scene.add(goldLight);
        
        // Create raycaster
        this.raycaster = new THREE.Raycaster();
        
        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    async loadCoinModel() {
        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();
            loader.load(
                'Copilot3D-d9aba749-7d22-4170-8f7d-3991895511f0.glb',
                (gltf) => {
                    this.coinModel = gltf.scene;
                    
                    // Make the coin golden and emissive
                    this.coinModel.traverse((child) => {
                        if (child.isMesh) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: 0xffd700,
                                metalness: 0.8,
                                roughness: 0.2,
                                emissive: 0xffa500,
                                emissiveIntensity: 0.3
                            });
                        }
                    });
                    
                    resolve();
                },
                undefined,
                (error) => {
                    console.warn('Could not load GLB model, using fallback:', error);
                    // Create fallback coin geometry
                    this.coinModel = this.createFallbackCoin();
                    resolve();
                }
            );
        });
    }

    createFallbackCoin() {
        const group = new THREE.Group();
        
        // Coin body
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0xffa500,
            emissiveIntensity: 0.3
        });
        const coin = new THREE.Mesh(geometry, material);
        coin.rotation.x = Math.PI / 2;
        group.add(coin);
        
        // Add ring detail
        const ringGeometry = new THREE.TorusGeometry(0.25, 0.02, 8, 32);
        const ring = new THREE.Mesh(ringGeometry, material);
        ring.position.z = 0.03;
        group.add(ring);
        
        const ring2 = ring.clone();
        ring2.position.z = -0.03;
        group.add(ring2);
        
        return group;
    }

    spawnCoins() {
        for (let i = 0; i < this.totalCoins; i++) {
            this.createCoin(i);
        }
        this.updateCoinsRemaining();
    }

    createCoin(index) {
        // Clone the coin model
        const coin = this.coinModel.clone();
        
        // Calculate position around the user
        const angle = (Math.PI * 2 * index) / this.totalCoins;
        const distance = 4 + Math.random() * 3; // 4 to 7 meters away
        const x = Math.cos(angle) * distance;
        const z = -Math.abs(Math.sin(angle) * distance) - 2; // Always in front
        const y = -1 + Math.random() * 3; // -1 to 2 meters (relative to camera)
        
        coin.position.set(x, y, z);
        coin.scale.set(1.5, 1.5, 1.5);
        
        // Store coin data
        coin.userData = {
            id: index,
            collected: false,
            originalY: y,
            floatOffset: Math.random() * Math.PI * 2,
            floatSpeed: 1 + Math.random() * 0.5,
            floatAmplitude: 0.15 + Math.random() * 0.1,
            rotationSpeed: 1 + Math.random() * 0.5
        };
        
        this.scene.add(coin);
        this.coins.push(coin);
    }

    setupControls() {
        // Touch/click to collect coins
        this.gameCanvas.addEventListener('click', (e) => this.onCanvasClick(e));
        this.gameCanvas.addEventListener('touchstart', (e) => this.onCanvasTouch(e), { passive: false });
        
        // Device orientation for looking around
        if (window.DeviceOrientationEvent) {
            // Request permission for iOS 13+
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                DeviceOrientationEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            this.enableDeviceOrientation();
                        }
                    })
                    .catch(console.error);
            } else {
                this.enableDeviceOrientation();
            }
        }
        
        // Fallback: touch drag to look around
        let lastTouchX = 0;
        let lastTouchY = 0;
        let isDragging = false;
        
        this.gameCanvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
            }
        }, { passive: true });
        
        this.gameCanvas.addEventListener('touchmove', (e) => {
            if (!isDragging || !e.touches.length) return;
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            
            const deltaX = (touchX - lastTouchX) * 0.005;
            const deltaY = (touchY - lastTouchY) * 0.005;
            
            this.camera.rotation.y -= deltaX;
            this.camera.rotation.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, this.camera.rotation.x - deltaY));
            
            lastTouchX = touchX;
            lastTouchY = touchY;
        }, { passive: true });
        
        this.gameCanvas.addEventListener('touchend', () => {
            isDragging = false;
        }, { passive: true });
    }

    enableDeviceOrientation() {
        this.orientationEnabled = true;
        window.addEventListener('deviceorientation', (e) => {
            if (e.alpha !== null) {
                this.deviceOrientation.alpha = e.alpha;
                this.deviceOrientation.beta = e.beta;
                this.deviceOrientation.gamma = e.gamma;
            }
        });
    }

    onCanvasClick(e) {
        const rect = this.gameCanvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.checkCoinHit();
    }

    onCanvasTouch(e) {
        e.preventDefault();
        if (e.touches.length > 0) {
            const rect = this.gameCanvas.getBoundingClientRect();
            this.mouse.x = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
            this.checkCoinHit();
        }
    }

    checkCoinHit() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const collectableCoins = this.coins.filter(c => !c.userData.collected);
        const intersects = this.raycaster.intersectObjects(collectableCoins, true);
        
        if (intersects.length > 0) {
            // Find the parent coin object
            let coinObject = intersects[0].object;
            while (coinObject.parent && !coinObject.userData.id && coinObject.userData.id !== 0) {
                coinObject = coinObject.parent;
            }
            
            // Find the actual coin in our array
            const coin = this.coins.find(c => c === coinObject || c.children.includes(coinObject) || this.isDescendant(c, intersects[0].object));
            
            if (coin && !coin.userData.collected) {
                this.collectCoin(coin);
            }
        }
    }

    isDescendant(parent, child) {
        let current = child;
        while (current) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    }

    collectCoin(coin) {
        if (coin.userData.collected) return;
        
        coin.userData.collected = true;
        
        // Create collection effect
        this.createCollectEffect(coin.position.clone());
        
        // Animate coin collection
        const startScale = coin.scale.x;
        const startY = coin.position.y;
        const duration = 300;
        const startTime = Date.now();
        
        const animateCollection = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Scale up and fade
            const scale = startScale * (1 + progress * 0.5);
            coin.scale.set(scale, scale, scale);
            coin.position.y = startY + progress * 0.5;
            
            // Fade out by scaling materials
            coin.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.opacity = 1 - progress;
                    child.material.transparent = true;
                }
            });
            
            if (progress < 1) {
                requestAnimationFrame(animateCollection);
            } else {
                this.scene.remove(coin);
            }
        };
        
        animateCollection();
        
        // Update score
        this.score += 10;
        this.updateScore();
        this.updateCoinsRemaining();
        
        // Vibrate
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // Flash crosshair
        this.crosshair.classList.add('hit');
        setTimeout(() => this.crosshair.classList.remove('hit'), 200);
        
        // Check win condition
        const remaining = this.coins.filter(c => !c.userData.collected).length;
        if (remaining === 0) {
            setTimeout(() => this.endGame(), 1000);
        }
    }

    createCollectEffect(position) {
        const particleCount = 12;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.05, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffd700,
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(geometry, material);
            
            particle.position.copy(position);
            
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 0.02 + Math.random() * 0.02;
            particle.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                0.02 + Math.random() * 0.02,
                Math.sin(angle) * speed
            );
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate particles
        const startTime = Date.now();
        const animateParticles = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / 500;
            
            particles.forEach(particle => {
                particle.position.add(particle.userData.velocity);
                particle.material.opacity = 1 - progress;
                particle.scale.multiplyScalar(0.95);
            });
            
            if (progress < 1) {
                requestAnimationFrame(animateParticles);
            } else {
                particles.forEach(p => this.scene.remove(p));
            }
        };
        
        animateParticles();
    }

    updateScore() {
        this.scoreValue.textContent = this.score;
        this.scoreValue.classList.add('pulse');
        setTimeout(() => this.scoreValue.classList.remove('pulse'), 300);
    }

    updateCoinsRemaining() {
        const remaining = this.coins.filter(c => !c.userData.collected).length;
        this.coinsLeft.textContent = remaining;
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    animate() {
        if (this.gameState !== 'playing') return;
        
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();
        
        // Update device orientation
        if (this.orientationEnabled) {
            const alpha = THREE.MathUtils.degToRad(this.deviceOrientation.alpha || 0);
            const beta = THREE.MathUtils.degToRad(this.deviceOrientation.beta || 0);
            const gamma = THREE.MathUtils.degToRad(this.deviceOrientation.gamma || 0);
            
            // Apply device orientation to camera
            this.camera.rotation.order = 'YXZ';
            this.camera.rotation.x = beta - Math.PI / 2;
            this.camera.rotation.y = -alpha;
            this.camera.rotation.z = -gamma;
        }
        
        // Animate coins
        this.coins.forEach(coin => {
            if (!coin.userData.collected) {
                // Floating animation
                const floatY = Math.sin(time * coin.userData.floatSpeed + coin.userData.floatOffset) * coin.userData.floatAmplitude;
                coin.position.y = coin.userData.originalY + floatY;
                
                // Rotation animation
                coin.rotation.y += delta * coin.userData.rotationSpeed * 2;
            }
        });
        
        this.renderer.render(this.scene, this.camera);
    }

    endGame() {
        this.gameState = 'gameover';
        this.finalScore.textContent = this.score;
        
        this.stopCamera();
        
        this.gameScreen.classList.remove('active');
        this.gameOverScreen.classList.add('active');
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
    }

    restartGame() {
        // Clean up
        this.coins.forEach(coin => {
            this.scene.remove(coin);
        });
        this.coins = [];
        
        // Reset UI
        this.gameOverScreen.classList.remove('active');
        this.instructionsOverlay.classList.remove('fade-out');
        
        // Reset camera rotation
        if (this.camera) {
            this.camera.rotation.set(0, 0, 0);
        }
        
        // Start new game
        this.score = 0;
        this.updateScore();
        this.gameScreen.classList.add('active');
        this.loadingIndicator.classList.remove('hidden');
        
        this.initCamera().then(() => {
            this.spawnCoins();
            this.gameState = 'playing';
            this.loadingIndicator.classList.add('hidden');
            this.animate();
            
            setTimeout(() => {
                this.instructionsOverlay.classList.add('fade-out');
            }, 4000);
        }).catch((error) => {
            console.error('Failed to restart:', error);
            this.loadingIndicator.classList.add('hidden');
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ARCoinGame();
});

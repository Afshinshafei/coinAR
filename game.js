// AR Coin Collector Game Logic

class ARCoinGame {
    constructor() {
        this.score = 0;
        this.coins = [];
        this.gameState = 'menu'; // menu, playing, gameover
        this.totalCoins = 8;
        this.scene = null;
        this.coinsContainer = null;
        this.cameraStream = null;
        
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
        
        this.init();
    }

    init() {
        // Check camera support
        this.checkARSupport();
        
        // Event listeners
        this.startButton.addEventListener('click', () => this.startGame());
        this.restartButton.addEventListener('click', () => this.restartGame());
        
        // Register custom A-Frame components
        this.registerComponents();
    }

    registerComponents() {
        // Register float animation component
        if (!AFRAME.components['float-animation']) {
            AFRAME.registerComponent('float-animation', {
                schema: {
                    amplitude: { type: 'number', default: 0.15 },
                    speed: { type: 'number', default: 1.5 }
                },
                init: function() {
                    this.originalY = this.el.object3D.position.y;
                    this.time = Math.random() * Math.PI * 2; // Random phase
                },
                tick: function(time, delta) {
                    this.time += (delta / 1000) * this.data.speed;
                    const newY = this.originalY + Math.sin(this.time) * this.data.amplitude;
                    this.el.object3D.position.y = newY;
                }
            });
        }

        // Register glow effect component
        if (!AFRAME.components['coin-glow']) {
            AFRAME.registerComponent('coin-glow', {
                init: function() {
                    this.el.addEventListener('model-loaded', () => {
                        const mesh = this.el.getObject3D('mesh');
                        if (mesh) {
                            mesh.traverse((node) => {
                                if (node.isMesh && node.material) {
                                    node.material.emissive = new THREE.Color(0xffd700);
                                    node.material.emissiveIntensity = 0.3;
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    checkARSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showARNotSupported();
        }
    }

    showARNotSupported() {
        this.arNotSupported.classList.remove('hidden');
        this.startButton.disabled = true;
        this.startButton.textContent = 'Camera Not Available';
    }

    async startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.coins = [];
        this.updateScore();
        
        // Show loading
        this.loadingIndicator.classList.remove('hidden');
        
        try {
            // Request camera access
            await this.initCamera();
            
            // Hide start screen, show game screen
            this.startScreen.classList.remove('active');
            this.gameScreen.classList.add('active');
            
            // Initialize AR scene
            this.initAR();
        } catch (error) {
            console.error('Failed to start camera:', error);
            this.loadingIndicator.classList.add('hidden');
            this.showARNotSupported();
        }
    }

    async initCamera() {
        const constraints = {
            video: {
                facingMode: 'environment', // Use back camera
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.cameraFeed.srcObject = this.cameraStream;
            
            // Wait for video to be ready
            return new Promise((resolve) => {
                this.cameraFeed.onloadedmetadata = () => {
                    this.cameraFeed.play();
                    resolve();
                };
            });
        } catch (error) {
            // Try front camera if back camera fails
            constraints.video.facingMode = 'user';
            this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.cameraFeed.srcObject = this.cameraStream;
            
            return new Promise((resolve) => {
                this.cameraFeed.onloadedmetadata = () => {
                    this.cameraFeed.play();
                    resolve();
                };
            });
        }
    }

    initAR() {
        this.scene = document.querySelector('a-scene');
        this.coinsContainer = document.getElementById('coinsContainer');
        
        // Wait for scene to be loaded
        if (this.scene.hasLoaded) {
            this.onSceneLoaded();
        } else {
            this.scene.addEventListener('loaded', () => {
                this.onSceneLoaded();
            });
        }
    }

    onSceneLoaded() {
        // Hide loading indicator
        this.loadingIndicator.classList.add('hidden');
        
        // Spawn coins
        this.spawnCoins();
        
        // Hide instructions after a few seconds
        setTimeout(() => {
            if (this.instructionsOverlay) {
                this.instructionsOverlay.style.opacity = '0';
                setTimeout(() => {
                    this.instructionsOverlay.style.display = 'none';
                }, 500);
            }
        }, 4000);
    }

    spawnCoins() {
        // Create coins floating in 3D space around the user
        for (let i = 0; i < this.totalCoins; i++) {
            this.createCoin(i);
        }
    }

    createCoin(index) {
        // Calculate position in a sphere around user
        const angle = (Math.PI * 2 * index) / this.totalCoins;
        const distance = 3 + Math.random() * 2; // 3 to 5 meters away
        const x = Math.cos(angle) * distance;
        const z = -Math.abs(Math.sin(angle) * distance); // Negative Z is in front
        const y = 1 + Math.random() * 2; // Height: 1 to 3 meters (floating in air)
        
        // Create coin entity
        const coin = document.createElement('a-entity');
        coin.setAttribute('gltf-model', '#coinModel');
        coin.setAttribute('position', `${x} ${y} ${z}`);
        coin.setAttribute('scale', '0.5 0.5 0.5');
        coin.setAttribute('class', 'coin');
        coin.setAttribute('data-coin-id', index.toString());
        coin.setAttribute('data-collected', 'false');
        
        // Add spinning animation
        coin.setAttribute('animation__spin', {
            property: 'rotation',
            to: '0 360 0',
            loop: true,
            dur: 2000 + Math.random() * 1000,
            easing: 'linear'
        });
        
        // Add floating animation
        coin.setAttribute('float-animation', {
            amplitude: 0.1 + Math.random() * 0.1,
            speed: 1 + Math.random() * 0.5
        });
        
        // Add glow effect
        coin.setAttribute('coin-glow', '');
        
        // Add click/touch handler
        coin.addEventListener('click', (evt) => {
            evt.stopPropagation();
            if (coin.getAttribute('data-collected') === 'false') {
                this.collectCoin(coin);
            }
        });
        
        // Also handle direct touch on mobile
        coin.addEventListener('mousedown', (evt) => {
            if (coin.getAttribute('data-collected') === 'false') {
                this.collectCoin(coin);
            }
        });
        
        this.coinsContainer.appendChild(coin);
        this.coins.push(coin);
    }

    collectCoin(coin) {
        if (coin.getAttribute('data-collected') === 'true') return;
        
        coin.setAttribute('data-collected', 'true');
        
        // Play collection animation
        coin.removeAttribute('animation__spin');
        coin.removeAttribute('float-animation');
        
        // Scale up and fade out animation
        coin.setAttribute('animation__collect', {
            property: 'scale',
            to: '1 1 1',
            dur: 300,
            easing: 'easeOutQuad'
        });
        
        coin.setAttribute('animation__fade', {
            property: 'components.material.material.opacity',
            to: 0,
            dur: 300,
            easing: 'easeOutQuad'
        });
        
        // Create particle effect
        this.createCollectEffect(coin);
        
        // Update score
        this.score += 10;
        this.updateScore();
        
        // Play sound feedback (vibration on mobile)
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // Remove coin after animation
        setTimeout(() => {
            if (coin.parentNode) {
                coin.parentNode.removeChild(coin);
            }
        }, 300);
        
        // Check if all coins collected
        const remaining = this.coins.filter(c => c.getAttribute('data-collected') === 'false').length;
        if (remaining === 0) {
            setTimeout(() => this.endGame(), 800);
        }
    }

    createCollectEffect(coin) {
        const position = coin.getAttribute('position');
        
        // Create sparkle particles
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('a-entity');
            const angle = (Math.PI * 2 * i) / 8;
            const speed = 0.5 + Math.random() * 0.5;
            
            particle.setAttribute('geometry', {
                primitive: 'sphere',
                radius: 0.05
            });
            particle.setAttribute('material', {
                color: '#ffd700',
                emissive: '#ffd700',
                emissiveIntensity: 1,
                shader: 'flat'
            });
            particle.setAttribute('position', position);
            
            // Animate outward
            const targetX = parseFloat(position.x) + Math.cos(angle) * speed;
            const targetY = parseFloat(position.y) + 0.3 + Math.random() * 0.3;
            const targetZ = parseFloat(position.z) + Math.sin(angle) * speed;
            
            particle.setAttribute('animation', {
                property: 'position',
                to: `${targetX} ${targetY} ${targetZ}`,
                dur: 400,
                easing: 'easeOutQuad'
            });
            
            particle.setAttribute('animation__fade', {
                property: 'material.opacity',
                from: 1,
                to: 0,
                dur: 400,
                easing: 'easeOutQuad'
            });
            
            this.coinsContainer.appendChild(particle);
            
            // Remove particle after animation
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 400);
        }
    }

    updateScore() {
        this.scoreValue.textContent = this.score;
        
        // Animate score update
        this.scoreValue.style.transform = 'scale(1.3)';
        this.scoreValue.style.color = '#ffd700';
        setTimeout(() => {
            this.scoreValue.style.transform = 'scale(1)';
            this.scoreValue.style.color = '#333';
        }, 200);
    }

    endGame() {
        this.gameState = 'gameover';
        this.finalScore.textContent = this.score;
        
        // Stop camera
        this.stopCamera();
        
        // Show game over screen
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
        // Clean up coins
        this.coins.forEach(coin => {
            if (coin.parentNode) {
                coin.parentNode.removeChild(coin);
            }
        });
        this.coins = [];
        
        // Reset game over screen
        this.gameOverScreen.classList.remove('active');
        
        // Show instructions overlay again
        if (this.instructionsOverlay) {
            this.instructionsOverlay.style.display = 'block';
            this.instructionsOverlay.style.opacity = '1';
        }
        
        // Start new game
        this.score = 0;
        this.updateScore();
        this.gameScreen.classList.add('active');
        this.loadingIndicator.classList.remove('hidden');
        
        // Reinitialize camera and game
        this.initCamera().then(() => {
            this.initAR();
        }).catch((error) => {
            console.error('Failed to restart camera:', error);
            this.loadingIndicator.classList.add('hidden');
        });
    }

    backToMenu() {
        this.gameState = 'menu';
        this.gameScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        this.startScreen.classList.add('active');
        
        // Stop camera
        this.stopCamera();
        
        // Clean up coins
        this.coins.forEach(coin => {
            if (coin.parentNode) {
                coin.parentNode.removeChild(coin);
            }
        });
        this.coins = [];
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ARCoinGame();
});

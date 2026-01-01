// AR Coin Collector Game Logic

class ARCoinGame {
    constructor() {
        this.score = 0;
        this.coins = [];
        this.gameState = 'menu'; // menu, playing, gameover
        this.totalCoins = 8;
        this.coinModel = 'Copilot3D-d9aba749-7d22-4170-8f7d-3991895511f0.glb';
        this.scene = null;
        
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
        
        this.init();
    }

    init() {
        // Check camera support (all modern phones have cameras)
        this.checkARSupport();
        
        // Event listeners
        this.startButton.addEventListener('click', () => this.startGame());
        this.restartButton.addEventListener('click', () => this.restartGame());
    }

    checkARSupport() {
        // Check for camera access
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showARNotSupported();
        }
        // AR.js works with camera, so most devices are supported
    }

    showARNotSupported() {
        this.arNotSupported.classList.remove('hidden');
        this.startButton.disabled = true;
        this.startButton.textContent = 'Camera Not Available';
    }

    startGame() {
        this.gameState = 'playing';
        this.score = 0;
        this.coins = [];
        this.updateScore();
        
        // Hide start screen, show game screen
        this.startScreen.classList.remove('active');
        this.gameScreen.classList.add('active');
        this.loadingIndicator.classList.remove('hidden');
        
        // Wait for A-Frame scene to initialize
        setTimeout(() => {
            this.initAR();
        }, 1000);
    }

    initAR() {
        this.scene = document.querySelector('a-scene');
        
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
        this.loadingIndicator.classList.add('hidden');
        this.spawnCoins();
        
        // Hide instructions after a few seconds
        setTimeout(() => {
            this.instructionsOverlay.style.opacity = '0';
            setTimeout(() => {
                this.instructionsOverlay.style.display = 'none';
            }, 500);
        }, 3000);
    }

    spawnCoins() {
        // Create coins in a circle around the user
        for (let i = 0; i < this.totalCoins; i++) {
            this.createCoin(i);
        }
    }

    createCoin(index) {
        // Calculate position in a circle around user
        const angle = (Math.PI * 2 * index) / this.totalCoins;
        const distance = 2 + Math.random() * 1.5; // 2 to 3.5 meters
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const y = 0.5 + Math.random() * 0.3; // Height: 0.5 to 0.8 meters
        
        // Create coin entity
        const coin = document.createElement('a-entity');
        coin.setAttribute('gltf-model', `url(${this.coinModel})`);
        coin.setAttribute('position', `${x} ${y} ${z}`);
        coin.setAttribute('scale', '0.3 0.3 0.3');
        coin.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 3000; easing: linear');
        coin.setAttribute('class', 'coin');
        coin.setAttribute('data-coin-id', index);
        coin.setAttribute('data-collected', 'false');
        
        // Add click handler
        coin.addEventListener('click', () => {
            if (coin.getAttribute('data-collected') === 'false') {
                this.collectCoin(coin);
            }
        });
        
        this.scene.appendChild(coin);
        this.coins.push(coin);
    }

    collectCoin(coin) {
        if (coin.getAttribute('data-collected') === 'true') return;
        
        coin.setAttribute('data-collected', 'true');
        
        // Animate coin collection
        coin.setAttribute('animation__scale', 'property: scale; to: 0.6 0.6 0.6; dur: 300; easing: easeOutQuad');
        coin.setAttribute('animation__opacity', 'property: components.material.material.opacity; to: 0; dur: 300');
        
        // Update score
        this.score += 10;
        this.updateScore();
        
        // Remove coin after animation
        setTimeout(() => {
            if (coin.parentNode) {
                coin.parentNode.removeChild(coin);
            }
        }, 300);
        
        // Check if all coins collected
        const remaining = this.coins.filter(c => c.getAttribute('data-collected') === 'false').length;
        if (remaining === 0) {
            setTimeout(() => this.endGame(), 500);
        }
    }

    updateScore() {
        this.scoreValue.textContent = this.score;
        
        // Animate score update
        this.scoreValue.style.transform = 'scale(1.2)';
        setTimeout(() => {
            this.scoreValue.style.transform = 'scale(1)';
        }, 200);
    }

    endGame() {
        this.gameState = 'gameover';
        this.finalScore.textContent = this.score;
        
        // Show game over screen
        this.gameScreen.classList.remove('active');
        this.gameOverScreen.classList.add('active');
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
        this.instructionsOverlay.style.display = 'block';
        this.instructionsOverlay.style.opacity = '1';
        
        // Start new game
        this.startGame();
    }

    backToMenu() {
        this.gameState = 'menu';
        this.gameScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        this.startScreen.classList.add('active');
        
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
    new ARCoinGame();
});


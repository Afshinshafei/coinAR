// AR Coin Collector Game Logic

class ARCoinGame {
    constructor() {
        this.score = 0;
        this.coins = [];
        this.gameState = 'menu'; // menu, playing, gameover
        this.totalCoins = 8;
        this.coinModel = 'Copilot3D-d9aba749-7d22-4170-8f7d-3991895511f0.glb';
        
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
        // Check AR support
        this.checkARSupport();
        
        // Event listeners
        this.startButton.addEventListener('click', () => this.startGame());
        this.restartButton.addEventListener('click', () => this.restartGame());
        
        // Touch event for coin collection
        document.addEventListener('touchstart', (e) => this.handleTouch(e));
        document.addEventListener('click', (e) => this.handleTouch(e));
    }

    async checkARSupport() {
        if ('xr' in navigator) {
            try {
                const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
                if (!isSupported) {
                    this.showARNotSupported();
                }
            } catch (e) {
                console.log('AR check failed:', e);
                this.showARNotSupported();
            }
        } else {
            this.showARNotSupported();
        }
    }

    showARNotSupported() {
        this.arNotSupported.classList.remove('hidden');
        this.startButton.disabled = true;
        this.startButton.textContent = 'AR Not Available';
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
        
        // Initialize AR
        setTimeout(() => {
            this.initAR();
        }, 500);
    }

    async initAR() {
        try {
            // For WebXR-based AR, we'll use a simpler approach
            // Since model-viewer handles the AR session, we'll work with the DOM
            
            // Hide loading indicator after initialization
            setTimeout(() => {
                this.loadingIndicator.classList.add('hidden');
                this.spawnCoins();
                
                // Hide instructions after a few seconds
                setTimeout(() => {
                    this.instructionsOverlay.style.opacity = '0';
                    setTimeout(() => {
                        this.instructionsOverlay.style.display = 'none';
                    }, 500);
                }, 3000);
            }, 2000);
            
        } catch (error) {
            console.error('AR initialization error:', error);
            this.loadingIndicator.classList.add('hidden');
            alert('Failed to start AR session. Please try again.');
            this.backToMenu();
        }
    }

    spawnCoins() {
        // Create coin elements in AR space
        const arContainer = document.getElementById('arContainer');
        
        for (let i = 0; i < this.totalCoins; i++) {
            const coin = this.createCoin(i);
            arContainer.appendChild(coin);
            this.coins.push(coin);
        }
    }

    createCoin(index) {
        // Calculate random position around user
        const angle = (Math.PI * 2 * index) / this.totalCoins + (Math.random() - 0.5) * 0.5;
        const distance = 1.5 + Math.random() * 2; // 1.5 to 3.5 meters
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const y = 0.5 + Math.random() * 0.5; // Height variation
        
        // Create model-viewer for each coin
        const coinElement = document.createElement('model-viewer');
        coinElement.className = 'ar-coin';
        coinElement.setAttribute('src', this.coinModel);
        coinElement.setAttribute('ar', '');
        coinElement.setAttribute('ar-modes', 'webxr scene-viewer');
        coinElement.setAttribute('camera-controls', '');
        coinElement.setAttribute('auto-rotate', '');
        coinElement.setAttribute('rotation-per-second', '120deg');
        coinElement.setAttribute('shadow-intensity', '1');
        
        // Set position using CSS transforms
        coinElement.style.position = 'absolute';
        coinElement.style.width = '80px';
        coinElement.style.height = '80px';
        
        // Calculate screen position (simplified projection)
        const screenX = 50 + (x / 4) * 40; // Center around 50%, scaled
        const screenY = 50 + (z / 4) * 40;
        
        coinElement.style.left = `${screenX}%`;
        coinElement.style.top = `${screenY}%`;
        coinElement.style.transform = 'translate(-50%, -50%)';
        
        // Store 3D position data
        coinElement.dataset.x = x;
        coinElement.dataset.y = y;
        coinElement.dataset.z = z;
        coinElement.dataset.collected = 'false';
        coinElement.dataset.coinId = index;
        
        return coinElement;
    }

    handleTouch(event) {
        if (this.gameState !== 'playing') return;
        
        // Get touch/click position
        const touch = event.touches ? event.touches[0] : event;
        const x = touch.clientX;
        const y = touch.clientY;
        
        // Check if any coin was tapped
        this.coins.forEach(coin => {
            if (coin.dataset.collected === 'true') return;
            
            const rect = coin.getBoundingClientRect();
            
            // Check if touch is within coin bounds (with some margin)
            const margin = 20;
            if (x >= rect.left - margin && 
                x <= rect.right + margin && 
                y >= rect.top - margin && 
                y <= rect.bottom + margin) {
                this.collectCoin(coin);
            }
        });
    }

    collectCoin(coin) {
        if (coin.dataset.collected === 'true') return;
        
        coin.dataset.collected = 'true';
        
        // Animate coin collection
        coin.style.transition = 'all 0.3s ease-out';
        coin.style.transform = 'translate(-50%, -50%) scale(1.5)';
        coin.style.opacity = '0';
        
        // Update score
        this.score += 10;
        this.updateScore();
        
        // Remove coin after animation
        setTimeout(() => {
            coin.remove();
        }, 300);
        
        // Check if all coins collected
        const remaining = this.coins.filter(c => c.dataset.collected === 'false').length;
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
        this.coins.forEach(coin => coin.remove());
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
        this.coins.forEach(coin => coin.remove());
        this.coins = [];
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ARCoinGame();
});


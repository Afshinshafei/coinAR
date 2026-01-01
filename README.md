# AR Coin Collector

An augmented reality web game where players collect virtual coins in the real world using their mobile device's camera.

![AR Coin Collector](https://img.shields.io/badge/AR-WebXR-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Real AR Experience**: Uses WebXR API for true augmented reality
- **Simple Gameplay**: Walk around and tap coins to collect them
- **Score Tracking**: Keep track of your performance
- **Mobile-First Design**: Optimized for smartphone screens
- **GitHub Pages Ready**: Deploy instantly to GitHub Pages

## Demo

Play the game at: `https://[your-username].github.io/coinAR/`

## Browser Requirements

### Supported Devices & Browsers

| Platform | Browser | Version |
|----------|---------|---------|
| Android | Chrome | 79+ |
| Android | Edge | 79+ |
| iOS | Safari | 15.4+ |
| iOS | Chrome | 15.4+ (uses Safari WebKit) |

### Requirements
- Device with ARCore (Android) or ARKit (iOS) support
- Camera permissions enabled
- HTTPS connection (automatically provided by GitHub Pages)

## How to Play

1. Open the game on your mobile device
2. Tap "Start AR Game" button
3. Grant camera permissions when prompted
4. Point your camera at the ground or surfaces around you
5. Walk around to find coins floating in AR space
6. Tap on coins to collect them
7. Try to collect all coins to complete the game!

## Deployment to GitHub Pages

### Step 1: Create Repository

1. Go to [GitHub](https://github.com)
2. Click "New Repository"
3. Name it `coinAR` (or your preferred name)
4. Make it public
5. Click "Create repository"

### Step 2: Upload Files

Using Git:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/[your-username]/coinAR.git
git push -u origin main
```

Or use GitHub's web interface to upload files directly.

### Step 3: Enable GitHub Pages

1. Go to your repository Settings
2. Navigate to "Pages" in the left sidebar
3. Under "Source", select "Deploy from a branch"
4. Choose "main" branch and "/ (root)" folder
5. Click "Save"

### Step 4: Access Your Game

Your game will be live at:
```
https://[your-username].github.io/coinAR/
```

Note: It may take a few minutes for the site to become available.

## Local Testing

Since AR requires HTTPS, you need to test locally with a secure connection:

### Option 1: Using Python

```bash
# Python 3
python -m http.server 8000

# Then use ngrok or similar to create HTTPS tunnel
ngrok http 8000
```

### Option 2: Using Node.js

```bash
npx http-server -p 8000 --ssl
```

### Option 3: Deploy to GitHub Pages First

The easiest way is to deploy to GitHub Pages directly, as it provides HTTPS automatically.

## File Structure

```
coinAR/
├── index.html                          # Main HTML file
├── game.js                             # Game logic
├── styles.css                          # Styling
├── Copilot3D-*.glb                     # 3D coin model
└── README.md                           # This file
```

## Technical Details

### Technologies Used

- **WebXR Device API**: For AR capabilities
- **model-viewer**: Google's 3D model viewer with AR support
- **HTML5/CSS3/JavaScript**: Core web technologies
- **GLB 3D Model**: Optimized 3D coin model

### How It Works

1. The game uses `model-viewer` library which provides WebXR integration
2. When AR starts, coins are positioned at calculated coordinates around the user
3. Each coin is rendered as a 3D model with rotation animation
4. Touch detection determines when a coin is tapped
5. Collected coins are removed and the score updates
6. Game ends when all coins are collected

### Performance Considerations

- Limited to 8 coins for optimal performance
- Coins are positioned within 1.5-3.5 meters radius
- Efficient DOM manipulation for smooth gameplay
- Hardware-accelerated CSS transforms

## Customization

### Change Number of Coins

Edit `game.js`, line 8:

```javascript
this.totalCoins = 8; // Change to desired number
```

### Adjust Coin Placement

Edit `game.js`, `createCoin()` method:

```javascript
const distance = 1.5 + Math.random() * 2; // Change distance range
const y = 0.5 + Math.random() * 0.5; // Change height range
```

### Modify Scoring

Edit `game.js`, `collectCoin()` method:

```javascript
this.score += 10; // Change points per coin
```

### Change Colors

Edit `styles.css`, body gradient:

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

## Troubleshooting

### AR Not Working

- **Check Browser**: Ensure you're using a supported browser
- **Camera Permissions**: Make sure camera access is granted
- **HTTPS Required**: AR only works over secure connections
- **Device Support**: Verify your device supports ARCore/ARKit

### Coins Not Appearing

- **Wait for Initialization**: Give the AR session 2-3 seconds to start
- **Move Device**: Point camera at different surfaces
- **Check Console**: Open browser dev tools to see any errors

### Performance Issues

- **Close Other Apps**: Free up device memory
- **Reduce Coin Count**: Lower `totalCoins` value
- **Check Device**: Older devices may struggle with AR

## Credits

- Built with [model-viewer](https://modelviewer.dev/) by Google
- Uses WebXR Device API
- 3D Coin model provided

## License

MIT License - feel free to use and modify for your own projects!

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify device AR compatibility
3. Ensure HTTPS connection
4. Try on a different device/browser

## Future Enhancements

Potential features to add:
- Different coin types with varying points
- Time-based challenges
- Multiplayer support
- Persistent high scores
- Sound effects
- Multiple levels
- Power-ups and bonuses

---

Made with ❤️ for AR gaming enthusiasts


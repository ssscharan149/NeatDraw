

---

# NeatDraw 🎨

A modern, feature-rich drawing app built with React.  
Draw, sketch, erase, create shapes, fill with color, undo/redo, and save or download your artwork—all in your browser!

---

## Features

- **Freehand Drawing:** Pen, Brush, Pencil, and Eraser tools
- **Shapes:** Line, Rectangle, Circle, Ellipse (with live preview)
- **Fill or Outline:** Toggle to fill shapes with color or just draw the outline
- **Color Picker & Palette:** Choose any color or pick from common swatches
- **Adjustable Size:** Change brush and eraser size
- **Undo/Redo:** Keyboard shortcuts (Ctrl+Z / Ctrl+Y) and buttons
- **Clear Canvas:** Start fresh anytime
- **Save/Load:** Store your drawing in your browser’s local storage
- **Download:** Export your drawing as a PNG image
- **Dark UI:** Beautiful, modern interface with a black canvas background
- **Mobile-friendly:** Responsive design

---

## Demo

[Live Demo on GitHub Pages](https://ssscharan149.github.io/NeatDraw)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ssscharan149/NeatDraw.git
cd NeatDraw/drawingapp-react
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the app locally

```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment

This app is ready to deploy for free on [GitHub Pages](https://pages.github.com/):

1. Make sure your `package.json` includes:
   ```json
   "homepage": "https://your-username.github.io/NeatDraw",
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d build"
   }
   ```
2. Deploy:
   ```bash
   npm run deploy
   ```
3. Visit: `https://ssscharan149.github.io/NeatDraw`

---

## Keyboard Shortcuts

- **Undo:** Ctrl+Z (Cmd+Z on Mac)
- **Redo:** Ctrl+Y (Cmd+Y on Mac)

---

## Credits
Inspired by classic paint apps and modern web tools.

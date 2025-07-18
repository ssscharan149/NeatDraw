import React, { useRef, useState } from 'react';
import './App.css';

function App() {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]); // Array of image data
  const [historyIndex, setHistoryIndex] = useState(-1); // Pointer to current state
  const [hasMoved, setHasMoved] = useState(false); // Track if mouse moved during stroke
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [eraserSize, setEraserSize] = useState(20);
  const [strokeStyle, setStrokeStyle] = useState('pen'); // 'pen', 'brush', 'pencil', 'eraser'
  const [shapeType, setShapeType] = useState('freehand'); // 'freehand', 'line', 'rect', 'circle', 'ellipse'
  const [shapeStart, setShapeStart] = useState(null);
  const [shapeEnd, setShapeEnd] = useState(null);
  const [isDrawingShape, setIsDrawingShape] = useState(false);

  // --- Stroke-based drawing state ---
  const [strokes, setStrokes] = useState([]); // Array of stroke objects
  const [strokeIndex, setStrokeIndex] = useState(0); // Pointer for undo/redo

  // --- Freehand drawing state for stroke-based ---
  const [currentPoints, setCurrentPoints] = useState([]);

  const getCurrentSize = () => (strokeStyle === 'eraser' ? eraserSize : brushSize);

  const saveToHistory = (customCanvas) => {
    const canvas = customCanvas || canvasRef.current;
    const dataUrl = canvas.toDataURL();
    let newHistory = history;
    if (historyIndex < history.length - 1) {
      newHistory = history.slice(0, historyIndex + 1);
    }
    if (newHistory.length === 0 || newHistory[newHistory.length - 1] !== dataUrl) {
      newHistory = [...newHistory, dataUrl];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const setCtxStyle = (ctx, alpha = 1, width = null, color = null, pencil = false, eraser = false) => {
    ctx.lineWidth = width !== null ? width : getCurrentSize();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (eraser) {
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 1.0;
    } else {
      ctx.strokeStyle = color || brushColor;
      ctx.fillStyle = color || brushColor;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      if (pencil) {
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#222';
        ctx.fillStyle = '#222';
      }
    }
  };

  // Draw a brush dot at (x, y)
  const drawBrushDot = (x, y, eraser = false) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const size = eraser ? eraserSize : brushSize;
    setCtxStyle(ctx, 0.25, size * 2, null, false, eraser);
    ctx.beginPath();
    ctx.arc(x, y, (size * 2) / 2, 0, 2 * Math.PI);
    ctx.fill();
    setCtxStyle(ctx, 1, size, null, false, eraser);
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
    ctx.fill();
  };

  // Draw a dot at (x, y) for any tool
  const drawDot = (x, y) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (strokeStyle === 'brush') {
      drawBrushDot(x, y);
    } else if (strokeStyle === 'eraser') {
      drawBrushDot(x, y, true);
    } else if (strokeStyle === 'pencil') {
      setCtxStyle(ctx, 1.0, brushSize * 0.8, '#222', true);
      ctx.beginPath();
      ctx.arc(x, y, (brushSize * 0.8) / 2, 0, 2 * Math.PI);
      ctx.fill();
    } else {
      setCtxStyle(ctx);
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  // Redraw canvas from a dataUrl
  const restoreFromDataUrl = (dataUrl) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (dataUrl) {
      const img = new window.Image();
      img.src = dataUrl;
      img.onload = () => ctx.drawImage(img, 0, 0);
    }
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && history.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL();
      setHistory([dataUrl]);
      setHistoryIndex(0);
    }
  }, []);

  React.useEffect(() => {
    if (history.length > 0 && historyIndex >= 0) {
      restoreFromDataUrl(history[historyIndex]);
    }
  }, [historyIndex]);

  // Draw a shape preview (on top of the last saved state)
  const drawShapePreview = (ctx, start, end, style, size, color, eraser) => {
    setCtxStyle(ctx, 1, size, color, false, eraser);
    ctx.save();
    ctx.globalAlpha = 0.7;
    if (style === 'line') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (style === 'rect') {
      ctx.beginPath();
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      ctx.stroke();
    } else if (style === 'circle') {
      ctx.beginPath();
      const r = Math.hypot(end.x - start.x, end.y - start.y);
      ctx.arc(start.x, start.y, r, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (style === 'ellipse') {
      ctx.beginPath();
      const rx = Math.abs(end.x - start.x);
      const ry = Math.abs(end.y - start.y);
      ctx.ellipse(start.x, start.y, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Draw a shape permanently (on mouse up)
  const drawShapeFinal = (ctx, start, end, style, size, color, eraser) => {
    setCtxStyle(ctx, 1, size, color, false, eraser);
    if (style === 'line') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (style === 'rect') {
      ctx.beginPath();
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      ctx.stroke();
    } else if (style === 'circle') {
      ctx.beginPath();
      const r = Math.hypot(end.x - start.x, end.y - start.y);
      ctx.arc(start.x, start.y, r, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (style === 'ellipse') {
      ctx.beginPath();
      const rx = Math.abs(end.x - start.x);
      const ry = Math.abs(end.y - start.y);
      ctx.ellipse(start.x, start.y, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  // --- Freehand drawing logic ---
  const startDrawing = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.nativeEvent.clientX - rect.left;
    const y = e.nativeEvent.clientY - rect.top;
    if (shapeType !== 'freehand') {
      setShapeStart({ x, y });
      setShapeEnd({ x, y });
      setIsDrawingShape(true);
      setDrawing(false);
    } else {
      setDrawing(true);
      setHasMoved(false);
      setLastPos({ x, y });
      setCurrentPoints([{ x, y }]);
    }
  };

  const stopDrawing = (e) => {
    if (shapeType !== 'freehand') {
      if (!isDrawingShape) return;
      setIsDrawingShape(false);
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.nativeEvent.clientX - rect.left;
      const y = e.nativeEvent.clientY - rect.top;
      const end = { x, y };
      setShapeEnd(end);
      // Draw the final shape on the canvas (do NOT restore last state)
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      drawShapeFinal(
        ctx,
        shapeStart,
        end,
        shapeType,
        getCurrentSize(),
        strokeStyle === 'eraser' ? '#fff' : brushColor,
        strokeStyle === 'eraser'
      );
      // Add shape stroke to strokes array
      const newStroke = {
        type: 'shape',
        style: strokeStyle,
        color: strokeStyle === 'eraser' ? '#fff' : brushColor,
        size: getCurrentSize(),
        shapeType,
        start: shapeStart,
        end,
      };
      let newStrokes = strokes;
      if (strokeIndex < strokes.length) {
        newStrokes = strokes.slice(0, strokeIndex);
      }
      setStrokes([...newStrokes, newStroke]);
      setStrokeIndex((prev) => prev + 1);
      setShapeStart(null);
      setShapeEnd(null);
      return;
    }
    if (!drawing) return;
    setDrawing(false);
    if (!hasMoved) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.nativeEvent.clientX - rect.left;
      const y = e.nativeEvent.clientY - rect.top;
      setCurrentPoints((pts) => [...pts, { x, y }]);
    }
    // Add freehand stroke to strokes array
    if (currentPoints.length > 1) {
      const newStroke = {
        type: 'freehand',
        style: strokeStyle,
        color: strokeStyle === 'eraser' ? '#fff' : brushColor,
        size: getCurrentSize(),
        points: currentPoints,
      };
      let newStrokes = strokes;
      if (strokeIndex < strokes.length) {
        newStrokes = strokes.slice(0, strokeIndex);
      }
      setStrokes([...newStrokes, newStroke]);
      setStrokeIndex((prev) => prev + 1);
    }
    setCurrentPoints([]);
  };

  //Draw brush/eraser dots along the path
  const drawBrushLine = (x0, y0, x1, y1, eraser = false) => {
    const size = eraser ? eraserSize : brushSize;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const step = size / 2.5;
    for (let d = 0; d < dist; d += step) {
      const t = d / dist;
      const ix = x0 + (x1 - x0) * t;
      const iy = y0 + (y1 - y0) * t;
      drawBrushDot(ix, iy, eraser);
    }
    drawBrushDot(x1, y1, eraser); 
  };

  const draw = (e) => {
    if (shapeType !== 'freehand') {
      if (!isDrawingShape) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.nativeEvent.clientX - rect.left;
      const y = e.nativeEvent.clientY - rect.top;
      setShapeEnd({ x, y });
      // Preview: clear, redraw last state, then draw preview shape
      replayStrokes();
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      drawShapePreview(
        ctx,
        shapeStart,
        { x, y },
        shapeType,
        getCurrentSize(),
        strokeStyle === 'eraser' ? '#fff' : brushColor,
        strokeStyle === 'eraser'
      );
      return;
    }
    if (!drawing) return;
    setHasMoved(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.nativeEvent.clientX - rect.left;
    const y = e.nativeEvent.clientY - rect.top;
    setCurrentPoints((pts) => [...pts, { x, y }]);
    // Draw current segment for live feedback
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    replayStrokes();
    if (currentPoints.length > 0) {
      ctx.save();
      setCtxStyle(ctx, 1, getCurrentSize(), strokeStyle === 'eraser' ? '#fff' : brushColor, strokeStyle === 'pencil', strokeStyle === 'eraser');
      ctx.beginPath();
      ctx.moveTo(currentPoints[currentPoints.length - 1].x, currentPoints[currentPoints.length - 1].y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    let newHistory = history;
    if (historyIndex < history.length - 1) {
      newHistory = history.slice(0, historyIndex + 1);
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const clearedDataUrl = canvas.toDataURL();
    if (newHistory.length === 0 || newHistory[newHistory.length - 1] !== clearedDataUrl) {
      newHistory = [...newHistory, clearedDataUrl];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  // Undo/Redo for stroke-based
  const undo = () => {
    if (strokeIndex > 0) {
      setStrokeIndex(strokeIndex - 1);
    }
  };

  const redo = () => {
    if (strokeIndex < strokes.length) {
      setStrokeIndex(strokeIndex + 1);
    }
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      setCtxStyle(ctx);
    }
  }, [brushSize, brushColor, strokeStyle, eraserSize]);

  // When eraser is selected, force shapeType to 'freehand'
  React.useEffect(() => {
    if (strokeStyle === 'eraser' && shapeType !== 'freehand') {
      setShapeType('freehand');
    }
  }, [strokeStyle]);

  // Replay all strokes up to strokeIndex
  const replayStrokes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < strokeIndex; i++) {
      const s = strokes[i];
      if (!s) continue;
      if (s.type === 'freehand') {
        // Draw freehand stroke
        ctx.save();
        setCtxStyle(ctx, 1, s.size, s.color, s.style === 'pencil', s.style === 'eraser');
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let j = 1; j < s.points.length; j++) {
          ctx.lineTo(s.points[j].x, s.points[j].y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (s.type === 'shape') {
        // Draw shape (line, rect, circle, ellipse)
        ctx.save();
        setCtxStyle(ctx, 1, s.size, s.color, false, s.style === 'eraser');
        const { start, end, shapeType } = s;
        if (shapeType === 'line') {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        } else if (shapeType === 'rect') {
          ctx.beginPath();
          ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
          ctx.stroke();
        } else if (shapeType === 'circle') {
          ctx.beginPath();
          const r = Math.hypot(end.x - start.x, end.y - start.y);
          ctx.arc(start.x, start.y, r, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (shapeType === 'ellipse') {
          ctx.beginPath();
          const rx = Math.abs(end.x - start.x);
          const ry = Math.abs(end.y - start.y);
          ctx.ellipse(start.x, start.y, rx, ry, 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  };

  // Redraw canvas from strokes on every change
  React.useEffect(() => {
    replayStrokes();
  }, [strokes, strokeIndex]);

  return (
    <div className="App">
      <h2>NeatDraw</h2>
      <div style={{ marginBottom: 10 }}>
        <button onClick={clearCanvas}>Clear</button>
        <button onClick={undo} disabled={historyIndex <= 0} style={{ marginLeft: 8 }}>Undo</button>
        <button onClick={redo} disabled={historyIndex >= history.length - 1} style={{ marginLeft: 8 }}>Redo</button>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ marginRight: 10 }}>
          Color:
          <input
            type="color"
            value={brushColor}
            onChange={e => setBrushColor(e.target.value)}
            style={{ marginLeft: 5 }}
            disabled={strokeStyle === 'eraser'}
          />
        </label>
        <label style={{ marginRight: 10 }}>
          Size:
          <input
            type="range"
            min={1}
            max={50}
            value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            style={{ marginLeft: 5 }}
            disabled={strokeStyle === 'eraser'}
          />
          <span style={{ marginLeft: 8 }}>{brushSize}px</span>
        </label>
        {strokeStyle === 'eraser' && (
          <label style={{ marginRight: 10 }}>
            Eraser Size:
            <input
              type="range"
              min={5}
              max={80}
              value={eraserSize}
              onChange={e => setEraserSize(Number(e.target.value))}
              style={{ marginLeft: 5 }}
            />
            <span style={{ marginLeft: 8 }}>{eraserSize}px</span>
          </label>
        )}
        <label style={{ marginRight: 10 }}>
          Shape:
          <select value={shapeType} onChange={e => setShapeType(e.target.value)} style={{ marginLeft: 5 }} disabled={strokeStyle === 'eraser'}>
            <option value="freehand">Freehand</option>
            <option value="line">Line</option>
            <option value="rect">Rectangle</option>
            <option value="circle">Circle</option>
            <option value="ellipse">Ellipse</option>
          </select>
        </label>
        <label>
          Style:
          <select value={strokeStyle} onChange={e => setStrokeStyle(e.target.value)} style={{ marginLeft: 5 }}>
            <option value="pen">Pen</option>
            <option value="brush">Brush</option>
            <option value="pencil">Pencil</option>
            <option value="eraser">Eraser</option>
          </select>
        </label>
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={400}
        style={{ border: '1px solid #000', background: '#fff' }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onMouseMove={draw}
      />
    </div>
  );
}

export default App;

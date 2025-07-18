import React, { useRef, useState } from 'react';
import './App.css';

const COMMON_COLORS = [
  '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#888888', '#ffa500', '#800080'
];

function App() {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]); // Array of image data
  const [historyIndex, setHistoryIndex] = useState(-1); // Pointer to current state
  const [hasMoved, setHasMoved] = useState(false); // Track if mouse moved during stroke
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(5);
  const [eraserSize, setEraserSize] = useState(20);
  const [tool, setTool] = useState('pen'); // 'pen', 'brush', 'pencil', 'eraser'
  const [shapeType, setShapeType] = useState('freehand'); // 'freehand', 'line', 'rect', 'circle', 'ellipse'
  const [shapeStart, setShapeStart] = useState(null);
  const [shapeEnd, setShapeEnd] = useState(null);
  const [isDrawingShape, setIsDrawingShape] = useState(false);

  // --- Stroke-based drawing state ---
  const [strokes, setStrokes] = useState([]); // Array of stroke objects
  const [strokeIndex, setStrokeIndex] = useState(0); // Pointer for undo/redo

  // --- Freehand drawing state for stroke-based ---
  const [currentPoints, setCurrentPoints] = useState([]);

  const getCurrentSize = () => (tool === 'eraser' ? eraserSize : brushSize);

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
      ctx.strokeStyle = '#000'; // black background
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 1.0;
    } else {
      ctx.strokeStyle = color || brushColor;
      ctx.fillStyle = color || brushColor;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      if (pencil) {
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#ccc';
        ctx.fillStyle = '#ccc';
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
    if (tool === 'brush') {
      drawBrushDot(x, y);
    } else if (tool === 'eraser') {
      drawBrushDot(x, y, true);
    } else if (tool === 'pencil') {
      setCtxStyle(ctx, 1.0, brushSize * 0.8, '#ccc', true);
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
        tool === 'eraser' ? '#000' : brushColor,
        tool === 'eraser'
      );
      // Add shape stroke to strokes array
      const newStroke = {
        type: 'shape',
        style: tool,
        color: tool === 'eraser' ? '#000' : brushColor,
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
    if (currentPoints.length === 1 || currentPoints.length > 1) {
      const newStroke = {
        type: 'freehand',
        style: tool,
        color: tool === 'eraser' ? '#000' : brushColor,
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
        tool === 'eraser' ? '#000' : brushColor,
        tool === 'eraser'
      );
      return;
    }
    if (!drawing) return;
    setHasMoved(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.nativeEvent.clientX - rect.left;
    const y = e.nativeEvent.clientY - rect.top;
    // Use a local array for live feedback
    const newPoint = { x, y };
    const pointsForLive = [...currentPoints, newPoint];
    setCurrentPoints(pointsForLive);
    // Draw current segment for live feedback
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    replayStrokes();
    if (pointsForLive.length === 1) {
      ctx.save();
      setCtxStyle(ctx, 1, getCurrentSize(), tool === 'eraser' ? '#000' : brushColor, tool === 'pencil', tool === 'eraser');
      ctx.beginPath();
      ctx.arc(pointsForLive[0].x, pointsForLive[0].y, getCurrentSize() / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    } else if (pointsForLive.length > 1) {
      ctx.save();
      setCtxStyle(ctx, 1, getCurrentSize(), tool === 'eraser' ? '#000' : brushColor, tool === 'pencil', tool === 'eraser');
      ctx.beginPath();
      ctx.moveTo(pointsForLive[0].x, pointsForLive[0].y);
      for (let i = 1; i < pointsForLive.length; i++) {
        ctx.lineTo(pointsForLive[i].x, pointsForLive[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  };

  const clearCanvas = () => {
    setStrokes([]);
    setStrokeIndex(0);
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
  }, [brushSize, brushColor, tool, eraserSize]);

  // When eraser is selected, force shapeType to 'freehand'
  React.useEffect(() => {
    if (tool === 'eraser' && shapeType !== 'freehand') {
      setShapeType('freehand');
    }
  }, [tool]);

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
        ctx.save();
        setCtxStyle(ctx, 1, s.size, s.color, s.style === 'pencil', s.style === 'eraser');
        if (s.points.length === 1) {
          // Draw a dot
          ctx.beginPath();
          ctx.arc(s.points[0].x, s.points[0].y, s.size / 2, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(s.points[0].x, s.points[0].y);
          for (let j = 1; j < s.points.length; j++) {
            ctx.lineTo(s.points[j].x, s.points[j].y);
          }
          ctx.stroke();
        }
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

  // Keyboard shortcuts for undo/redo
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (strokeIndex > 0) undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (strokeIndex < strokes.length) redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [strokeIndex, strokes.length]);

  // Tool button UI
  const toolButtons = [
    { key: 'pen', label: 'Pen' },
    { key: 'brush', label: 'Brush' },
    { key: 'pencil', label: 'Pencil' },
    { key: 'eraser', label: 'Eraser' },
  ];

  return (
    <div className="App" style={{ background: '#181818', minHeight: '100vh', color: '#fff' }}>
      <h2 style={{ color: '#fff' }}>NeatDraw</h2>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
        {toolButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => setTool(btn.key)}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: tool === btn.key ? '2px solid #fff' : '1px solid #444',
              background: tool === btn.key ? '#333' : '#222',
              color: tool === btn.key ? '#fff' : '#ccc',
              fontWeight: tool === btn.key ? 'bold' : 'normal',
              fontSize: 16,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: tool === btn.key ? '0 0 8px #fff2' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
        <label style={{ marginRight: 10, display: 'flex', alignItems: 'center' }}>
          Color:
          <input
            type="color"
            value={brushColor}
            onChange={e => setBrushColor(e.target.value)}
            style={{ marginLeft: 5, width: 32, height: 32, border: 'none', background: 'none' }}
            disabled={tool === 'eraser'}
          />
        </label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {COMMON_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setBrushColor(color)}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: brushColor === color ? '2px solid #fff' : '1px solid #444',
                background: color,
                margin: 0,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: brushColor === color ? '0 0 6px #fff8' : 'none',
                transition: 'all 0.15s',
              }}
              disabled={tool === 'eraser'}
              aria-label={color}
            />
          ))}
        </div>
        <label style={{ marginRight: 10, display: tool !== 'eraser' ? 'flex' : 'none', alignItems: 'center' }}>
          Size:
          <input
            type="range"
            min={1}
            max={50}
            value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            style={{ marginLeft: 5 }}
            disabled={tool === 'eraser'}
          />
          <span style={{ marginLeft: 8 }}>{brushSize}px</span>
        </label>
        {tool === 'eraser' && (
          <label style={{ marginRight: 10, display: 'flex', alignItems: 'center' }}>
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
          <select value={shapeType} onChange={e => setShapeType(e.target.value)} style={{ marginLeft: 5 }} disabled={tool === 'eraser'}>
            <option value="freehand">Freehand</option>
            <option value="line">Line</option>
            <option value="rect">Rectangle</option>
            <option value="circle">Circle</option>
            <option value="ellipse">Ellipse</option>
          </select>
        </label>
        {/* {tool === 'eraser' && (
          <span style={{ color: '#f88', marginLeft: 8, fontSize: '0.95em' }}>
            Eraser only works in freehand mode.
          </span>
        )} */}
        <button onClick={clearCanvas} style={{ marginLeft: 16, padding: '8px 18px', borderRadius: 6, border: '1px solid #444', background: '#222', color: '#fff', fontWeight: 'bold', fontSize: 16, cursor: 'pointer' }}>Clear</button>
        <button onClick={undo} disabled={strokeIndex <= 0} style={{ marginLeft: 8, padding: '8px 18px', borderRadius: 6, border: '1px solid #444', background: '#222', color: '#fff', fontWeight: 'bold', fontSize: 16, cursor: strokeIndex <= 0 ? 'not-allowed' : 'pointer', opacity: strokeIndex <= 0 ? 0.5 : 1 }}>Undo</button>
        <button onClick={redo} disabled={strokeIndex >= strokes.length} style={{ marginLeft: 8, padding: '8px 18px', borderRadius: 6, border: '1px solid #444', background: '#222', color: '#fff', fontWeight: 'bold', fontSize: 16, cursor: strokeIndex >= strokes.length ? 'not-allowed' : 'pointer', opacity: strokeIndex >= strokes.length ? 0.5 : 1 }}>Redo</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        style={{ border: '1px solid #fff', background: '#000', display: 'block', margin: '0 auto', boxShadow: '0 0 16px #000a' }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onMouseMove={draw}
      />
    </div>
  );
}

export default App;

import React, { useRef, useEffect, useState } from 'react';
import { Edit2, Eraser, Trash2, Download, Award } from 'lucide-react';

const COLORS = [
  '#000000', // Black
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#ec4899', // Pink
  '#8b5cf6'  // Purple
];

function Board({ socket, isDrawer, gameStatus, drawerName, canvasRef }) {
  const containerRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(5);
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Local cache of all draw events in this round to redraw on resize
  const drawHistoryRef = useRef([]);
  const prevPosRef = useRef({ x: 0, y: 0 });

  // Handle window resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      
      // Store current drawing content before resizing
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      // Update canvas resolution to match physical size
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Redraw history to scale
      redrawFromHistory();
    };

    window.addEventListener('resize', handleResize);
    // Initial run
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen to Socket.io drawing events
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDraw = (data) => {
      drawHistoryRef.current.push(data);
      drawOnCanvas(data);
    };

    const handleRemoteClear = () => {
      drawHistoryRef.current = [];
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    const handleDrawHistory = (history) => {
      drawHistoryRef.current = history;
      redrawFromHistory();
    };

    socket.on('draw', handleRemoteDraw);
    socket.on('clear_canvas', handleRemoteClear);
    socket.on('draw_history', handleDrawHistory);

    return () => {
      socket.off('draw', handleRemoteDraw);
      socket.off('clear_canvas', handleRemoteClear);
      socket.off('draw_history', handleDrawHistory);
    };
  }, [socket]);

  // Redraw the entire board from the stored history
  const redrawFromHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawHistoryRef.current.forEach(data => {
      drawOnCanvas(data);
    });
  };

  // Draw a single line segment on the canvas
  const drawOnCanvas = (data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Convert relative coordinates back to absolute coordinates for local canvas
    const x0 = data.x0 * w;
    const y0 = data.y0 * h;
    const x1 = data.x1 * w;
    const y1 = data.y1 * h;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = data.isErasing ? '#ffffff' : data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  // Mouse & Touch events
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    // Support both mouse and touch events
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    // Only the drawer can draw during active game rounds
    if (gameStatus === 'PLAYING' && !isDrawer) return;

    const coords = getCoordinates(e);
    prevPosRef.current = coords;
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (gameStatus === 'PLAYING' && !isDrawer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const currPos = getCoordinates(e);
    const w = canvas.width;
    const h = canvas.height;

    // Relative coordinates (0.0 to 1.0)
    const drawData = {
      x0: prevPosRef.current.x / w,
      y0: prevPosRef.current.y / h,
      x1: currPos.x / w,
      y1: currPos.y / h,
      color: color,
      size: size,
      isErasing: isErasing
    };

    // Draw locally immediately for instant feedback
    drawHistoryRef.current.push(drawData);
    drawOnCanvas(drawData);

    // Emit drawing action to room
    if (socket) {
      socket.emit('draw', drawData);
    }

    prevPosRef.current = currPos;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (gameStatus === 'PLAYING' && !isDrawer) return;
    
    if (window.confirm('確定要清除畫布嗎？')) {
      drawHistoryRef.current = [];
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (socket) {
        socket.emit('clear_canvas');
      }
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `codraw-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Check if drawer can draw
  const canDraw = gameStatus !== 'PLAYING' || isDrawer;

  return (
    <div className="glass-card board-container" ref={containerRef}>
      {/* Canvas Toolbar */}
      <div className="board-toolbar">
        {canDraw ? (
          <>
            <div className="toolbar-group">
              <button 
                className={`btn-icon ${!isErasing ? 'active' : ''}`}
                onClick={() => setIsErasing(false)}
                title="畫筆"
              >
                <Edit2 size={18} />
              </button>
              <button 
                className={`btn-icon ${isErasing ? 'active' : ''}`}
                onClick={() => setIsErasing(true)}
                title="橡皮擦"
              >
                <Eraser size={18} />
              </button>
            </div>

            {!isErasing && (
              <div className="toolbar-group">
                {COLORS.map((c) => (
                  <div
                    key={c}
                    className={`color-swatch ${color === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      setColor(c);
                      setIsErasing(false);
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    setIsErasing(false);
                  }}
                  style={{ width: '32px', height: '32px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  title="自訂顏色"
                />
              </div>
            )}

            <div className="toolbar-group">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>粗細: {size}px</span>
              <input
                type="range"
                min="1"
                max="40"
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value))}
                className="brush-slider"
              />
            </div>

            <div className="toolbar-group">
              <button className="btn btn-outline" onClick={clearCanvas} style={{ padding: '0.5rem 0.8rem' }}>
                <Trash2 size={16} /> 清除
              </button>
              <button className="btn btn-outline" onClick={downloadCanvas} style={{ padding: '0.5rem 0.8rem' }}>
                <Download size={16} /> 下載
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontWeight: 600 }}>
            <Award size={18} />
            <span>目前由 【{drawerName}】 正在作畫中，請認真猜題！</span>
          </div>
        )}
      </div>

      {/* Canvas Drawing Area */}
      <div className="canvas-wrapper">
        {gameStatus === 'PLAYING' && !isDrawer && (
          <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', pointerEvents: 'none', color: '#fff', fontSize: '0.8rem' }}>
            🔒 唯有畫家可以作畫
          </div>
        )}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
}

export default Board;

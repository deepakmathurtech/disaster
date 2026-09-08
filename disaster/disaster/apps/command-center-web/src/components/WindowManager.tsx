import React, { useRef, useState, useEffect } from 'react';
import { WindowState } from './windowTypes';

interface WindowManagerProps {
  win: WindowState;
  onUpdate: (updated: WindowState) => void;
  onClose: () => void;
  onFocus: () => void;
  children: React.ReactNode;
}

export default function WindowManager({
  win,
  onUpdate,
  onClose,
  onFocus,
  children,
}: WindowManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, winX: 0, winY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, winW: 0, winH: 0 });

  // Handle Dragging
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    onFocus();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      winX: win.x,
      winY: win.y,
    };
  };

  // Handle Resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFocus();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      winW: win.width,
      winH: win.height,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        const newX = Math.max(10, Math.min(window.innerWidth - 100, dragStart.current.winX + dx));
        const newY = Math.max(50, Math.min(window.innerHeight - 100, dragStart.current.winY + dy));
        onUpdate({ ...win, x: newX, y: newY, isMaximized: false });
      } else if (isResizing) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        const newW = Math.max(280, resizeStart.current.winW + dx);
        const newH = Math.max(200, resizeStart.current.winH + dy);
        onUpdate({ ...win, width: newW, height: newH, isMaximized: false });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, win, onUpdate]);

  if (!win.isOpen || win.isMinimized) return null;

  const style: React.CSSProperties = win.isMaximized
    ? {
        position: 'fixed',
        top: 48,
        left: 240,
        right: 320,
        bottom: 56,
        zIndex: win.zIndex + 10,
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        position: 'fixed',
        top: win.y,
        left: win.x,
        width: win.width,
        height: win.height,
        zIndex: win.zIndex,
        display: 'flex',
        flexDirection: 'column',
      };

  return (
    <div
      className={`float-win ${isDragging ? 'is-dragging' : ''}`}
      style={style}
      onMouseDown={onFocus}
    >
      {/* Titlebar / Drag Handle */}
      <div className="fw-hdr" onMouseDown={handleHeaderMouseDown}>
        <span className="fw-title">
          {win.icon} {win.title}
        </span>
        <div className="fw-actions">
          <button
            className="fw-btn-opt"
            title="Minimize"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ ...win, isMinimized: true });
            }}
          >
            🗕
          </button>
          <button
            className="fw-btn-opt"
            title={win.isMaximized ? 'Restore' : 'Maximize'}
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ ...win, isMaximized: !win.isMaximized });
            }}
          >
            {win.isMaximized ? '🗗' : '🗖'}
          </button>
          <button
            className="fw-close"
            title="Close"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Window Body */}
      <div className="fw-body-container" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      {/* Resize Handle */}
      {!win.isMaximized && (
        <div
          className="fw-resize-handle"
          onMouseDown={handleResizeMouseDown}
          title="Drag to resize window"
        />
      )}
    </div>
  );
}

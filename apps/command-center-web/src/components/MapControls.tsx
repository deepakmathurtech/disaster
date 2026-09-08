import React, { useEffect, useState, useCallback } from 'react';
import * as L from 'leaflet';

interface MapControlsProps {
  map: L.Map | null;
}

export default function MapControls({ map }: MapControlsProps) {
  const [zoom, setZoom] = useState<number>(map ? map.getZoom() : 14);
  const [bearing, setBearing] = useState<number>(0);
  const [minZoom, setMinZoom] = useState<number>(0);
  const [maxZoom, setMaxZoom] = useState<number>(19);

  const updateMapState = useCallback(() => {
    if (!map) return;
    setZoom(map.getZoom());
    setMinZoom(map.getMinZoom());
    setMaxZoom(map.getMaxZoom());

    // Check if map instance or rotation plugin provides bearing / rotation angle
    const currentBearing =
      typeof (map as any).getBearing === 'function'
        ? (map as any).getBearing()
        : typeof (map as any).getRotation === 'function'
        ? (map as any).getRotation()
        : (map as any)._bearing ?? (map as any)._rotation ?? 0;

    setBearing(currentBearing);
  }, [map]);

  useEffect(() => {
    if (!map) return;

    updateMapState();

    const events = ['zoomend', 'moveend', 'move', 'rotate', 'headingchange'];
    events.forEach(evt => map.on(evt, updateMapState));

    return () => {
      events.forEach(evt => map.off(evt, updateMapState));
    };
  }, [map, updateMapState]);

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (map && zoom < maxZoom) {
      map.zoomIn();
    }
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (map && zoom > minZoom) {
      map.zoomOut();
    }
  };

  const handleResetNorth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!map) return;

    // Use native bearing / rotation API if available
    if (typeof (map as any).setBearing === 'function') {
      (map as any).setBearing(0);
    } else if (typeof (map as any).setRotation === 'function') {
      (map as any).setRotation(0);
    } else if (typeof (map as any).resetNorth === 'function') {
      (map as any).resetNorth();
    } else if (typeof (map as any).setHeading === 'function') {
      (map as any).setHeading(0);
    }

    setBearing(0);
  };

  if (!map) return null;

  const isMinZoom = zoom <= minZoom;
  const isMaxZoom = zoom >= maxZoom;

  return (
    <div className="gmaps-controls-container" aria-label="Map controls" role="region">
      {/* Compass / North-Up Control */}
      <button
        type="button"
        className="gmaps-control-btn gmaps-compass-btn"
        onClick={handleResetNorth}
        title="Reset map orientation to north"
        aria-label="Reset map orientation to north"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            transform: `rotate(${-bearing}deg)`,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Compass Outer Ring */}
          <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
          {/* North Needle (Red Arrow) */}
          <path d="M12 3.5L15.2 12H12V3.5Z" fill="#ef4444" />
          <path d="M12 3.5L8.8 12H12V3.5Z" fill="#f87171" />
          {/* South Needle (Silver Arrow) */}
          <path d="M12 20.5L15.2 12H12V20.5Z" fill="#94a3b8" />
          <path d="M12 20.5L8.8 12H12V20.5Z" fill="#cbd5e1" />
          {/* Center Pivot Point */}
          <circle cx="12" cy="12" r="1.5" fill="#ffffff" />
          {/* 'N' text marker at top */}
          <text
            x="12"
            y="7.5"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="4.5"
            fontWeight="900"
            fontFamily="Inter, system-ui, sans-serif"
          >
            N
          </text>
        </svg>
      </button>

      {/* Zoom In / Out Controls */}
      <div className="gmaps-zoom-group">
        <button
          type="button"
          className="gmaps-control-btn gmaps-zoom-in"
          onClick={handleZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
          disabled={isMaxZoom}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="7" y1="2" x2="7" y2="12" />
            <line x1="2" y1="7" x2="12" y2="7" />
          </svg>
        </button>
        <div className="gmaps-control-divider" />
        <button
          type="button"
          className="gmaps-control-btn gmaps-zoom-out"
          onClick={handleZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
          disabled={isMinZoom}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="2" y1="7" x2="12" y2="7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

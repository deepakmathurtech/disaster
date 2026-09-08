import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Entity, Conflict } from '../App';

interface MapProps {
  entities: Entity[];
  conflicts: Conflict[];
  targetLocation: { lat: number; lng: number; zoom: number; name: string } | null;
  showFloodOverlay: boolean;
  showHeatmapOverlay: boolean;
  simulatedWaterLevel: number;
  onSelectEntity: (e: Entity) => void;
}

export default function SciFiRealMapWorkspace({
  entities,
  conflicts,
  targetLocation,
  showFloodOverlay,
  showHeatmapOverlay,
  simulatedWaterLevel,
  onSelectEntity
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const floodLayer = useRef<L.LayerGroup | null>(null);
  const heatmapLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletInstance.current) return;

    // Initialize Leaflet Map with Dark Sci-Fi CartoDB Vector Tiles
    const map = L.map(mapRef.current, {
      center: [12.9716, 77.5946],
      zoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    floodLayer.current = L.layerGroup().addTo(map);
    heatmapLayer.current = L.layerGroup().addTo(map);
    markersLayer.current = L.layerGroup().addTo(map);

    leafletInstance.current = map;

    return () => {
      map.remove();
      leafletInstance.current = null;
    };
  }, []);

  // Update center when area search triggers
  useEffect(() => {
    if (leafletInstance.current && targetLocation) {
      leafletInstance.current.flyTo([targetLocation.lat, targetLocation.lng], targetLocation.zoom, {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [targetLocation]);

  // Render Flood Water Inundation Polygon Overlays
  useEffect(() => {
    if (!leafletInstance.current || !floodLayer.current) return;
    floodLayer.current.clearLayers();

    if (showFloodOverlay) {
      const radiusMeters = 800 + simulatedWaterLevel * 250;
      // River Inundation Flood Zone Circle
      L.circle([12.9716, 77.5946], {
        radius: radiusMeters,
        color: '#0284c7',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#38bdf8',
        fillOpacity: 0.35
      }).addTo(floodLayer.current);
    }
  }, [showFloodOverlay, simulatedWaterLevel]);

  // Render Live Incident Heatmap Density Layers
  useEffect(() => {
    if (!leafletInstance.current || !heatmapLayer.current) return;
    heatmapLayer.current.clearLayers();

    if (showHeatmapOverlay) {
      entities.forEach((e) => {
        const isDamaged = e.current_state === 'DAMAGED' || e.current_state === 'BLOCKED';
        if (isDamaged || e.has_conflict) {
          L.circle([e.location.lat, e.location.lng], {
            radius: 1200,
            color: '#ef4444',
            weight: 1,
            fillColor: '#ef4444',
            fillOpacity: 0.22
          }).addTo(heatmapLayer.current!);
        }
      });
    }
  }, [showHeatmapOverlay, entities]);

  // Render Sci-Fi Pulsing Markers and Uncertainty Overlays
  useEffect(() => {
    if (!leafletInstance.current || !markersLayer.current) return;
    markersLayer.current.clearLayers();

    entities.forEach((e) => {
      const isDamaged = e.current_state === 'DAMAGED' || e.current_state === 'BLOCKED';
      const color = isDamaged ? '#ef4444' : e.current_state === 'OPERATIONAL' ? '#10b981' : '#38bdf8';

      if (e.is_stale) {
        L.circle([e.location.lat, e.location.lng], {
          radius: 700,
          color: '#f59e0b',
          weight: 2,
          dashArray: '6, 6',
          fillColor: '#f59e0b',
          fillOpacity: 0.2
        }).addTo(markersLayer.current!);
      }

      if (e.has_conflict) {
        L.circle([e.location.lat, e.location.lng], {
          radius: 900,
          color: '#ef4444',
          weight: 3,
          fillColor: '#ef4444',
          fillOpacity: 0.3
        }).addTo(markersLayer.current!);
      }

      const iconHtml = `
        <div class="scifi-marker ${e.is_stale ? 'stale-pulse' : ''} ${e.has_conflict ? 'conflict-pulse' : ''}">
          <div class="marker-core" style="background: ${color}; box-shadow: 0 0 15px ${color};">
            <span class="marker-type">${e.type[0]}</span>
          </div>
          <div class="marker-label">
            <div class="ml-name">${e.name}</div>
            <div class="ml-state" style="color: ${color}">${e.current_state} (${(e.confidence * 100).toFixed(0)}%)</div>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'scifi-leaflet-divicon',
        iconSize: [140, 40],
        iconAnchor: [20, 20]
      });

      const marker = L.marker([e.location.lat, e.location.lng], { icon: customIcon });
      marker.on('click', () => onSelectEntity(e));
      marker.addTo(markersLayer.current!);
    });
  }, [entities, onSelectEntity]);

  return (
    <div className="scifi-map-wrapper">
      <div ref={mapRef} className="leaflet-map-canvas" />

      {/* Sci-Fi Tactical HUD Overlay Lines */}
      <div className="hud-overlay-topleft">
        <div className="hud-line">SYSTEM: ONLINE ∙ 60 FPS</div>
        <div className="hud-line">SATELLITE SYNC: ACTIVE [GPS-NAVSTAR]</div>
        <div className="hud-line">FLOOD SIMULATION: <strong>{simulatedWaterLevel.toFixed(1)}m SURGE</strong></div>
      </div>
      <div className="hud-grid-v" />
      <div className="hud-grid-h" />
    </div>
  );
}

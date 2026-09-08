import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Entity, Conflict, AreaIntelligence } from '../App';

interface MapProps {
  areaData: AreaIntelligence | null;
  entities: Entity[];
  conflicts: Conflict[];
  activeLayers: {
    infrastructure: boolean;
    water_sources: boolean;
    incidents: boolean;
    field_units: boolean;
    uncertainty: boolean;
    flood_exposure: boolean;
  };
  onSelectEntity: (e: Entity) => void;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const stateColor = (state: string) => {
  if (state === 'OPERATIONAL') return '#10b981';
  if (state === 'BLOCKED' || state === 'DAMAGED') return '#ef4444';
  return '#38bdf8';
};

const typeIcon = (type: string) => {
  const m: Record<string, string> = {
    ROAD: '🛣', BRIDGE: '🌉', SHELTER: '🏠', HOSPITAL: '🏥', INCIDENT: '⚠',
  };
  return m[type] ?? '📍';
};

export default function AreaIntelligenceMapWorkspace({
  areaData, entities, conflicts, activeLayers, onSelectEntity,
}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const layers = useRef<Record<string, L.LayerGroup>>({});

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;

    const map = L.map(mapRef.current, {
      center: [12.9716, 77.5946],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(TILE_URL, { maxZoom: 19, subdomains: 'abcd' }).addTo(map);

    // attribution minimal
    L.control.attribution({ prefix: false }).addTo(map);

    layers.current.boundary  = L.layerGroup().addTo(map);
    layers.current.water     = L.layerGroup().addTo(map);
    layers.current.flood     = L.layerGroup().addTo(map);
    layers.current.uncertain = L.layerGroup().addTo(map);
    layers.current.markers   = L.layerGroup().addTo(map);

    mapInst.current = map;
    return () => { map.remove(); mapInst.current = null; };
  }, []);

  // Fly to area on change
  useEffect(() => {
    if (!mapInst.current || !areaData) return;
    const { center, boundary_polygon } = areaData.area;
    mapInst.current.flyTo([center.lat, center.lng], 14, { duration: 1.4, easeLinearity: 0.2 });

    layers.current.boundary.clearLayers();
    if (boundary_polygon?.length) {
      L.polygon(boundary_polygon as [number, number][], {
        color: '#38bdf8', weight: 1.5, dashArray: '6 4',
        fillColor: '#38bdf8', fillOpacity: 0.04,
      }).addTo(layers.current.boundary);
    }
  }, [areaData]);

  // Water + flood exposure
  useEffect(() => {
    layers.current.water?.clearLayers();
    layers.current.flood?.clearLayers();
    if (!areaData) return;

    if (activeLayers.water_sources) {
      areaData.water_sources.forEach(w => {
        L.circle([w.location.lat, w.location.lng], {
          radius: 300, color: '#0284c7', weight: 2,
          fillColor: '#0284c7', fillOpacity: 0.35,
        })
          .bindTooltip(`💧 ${w.name}`, { className: 'eoc-tooltip', permanent: false })
          .addTo(layers.current.water);
      });
    }

    if (activeLayers.flood_exposure) {
      areaData.water_sources.forEach(w => {
        L.circle([w.location.lat, w.location.lng], {
          radius: w.risk_radius_meters, color: '#38bdf8',
          weight: 1.5, dashArray: '4 6',
          fillColor: '#38bdf8', fillOpacity: 0.1,
        }).addTo(layers.current.flood);
      });
    }
  }, [areaData, activeLayers.water_sources, activeLayers.flood_exposure]);

  // Uncertainty + conflict zones
  useEffect(() => {
    layers.current.uncertain?.clearLayers();
    if (!activeLayers.uncertainty) return;

    entities.forEach(e => {
      if (e.is_stale) {
        L.circle([e.location.lat, e.location.lng], {
          radius: 600, color: '#f59e0b', weight: 1.5, dashArray: '6 6',
          fillColor: '#f59e0b', fillOpacity: 0.12,
        })
          .bindTooltip(`⚠ STALE: ${e.name}`, { permanent: false, className: 'eoc-tooltip' })
          .addTo(layers.current.uncertain);
      }
      if (e.has_conflict) {
        L.circle([e.location.lat, e.location.lng], {
          radius: 850, color: '#ef4444', weight: 2,
          fillColor: '#ef4444', fillOpacity: 0.2,
        }).addTo(layers.current.uncertain);
      }
    });
  }, [entities, activeLayers.uncertainty]);

  // Entity + incident + unit markers
  useEffect(() => {
    layers.current.markers?.clearLayers();

    // Infrastructure entities
    if (activeLayers.infrastructure) {
      entities.forEach(e => {
        const color = stateColor(e.current_state);
        const staleRing = e.is_stale ? 'box-shadow:0 0 0 3px #f59e0b,0 0 10px rgba(245,158,11,0.5);' : '';
        const html = `
          <div style="display:flex;align-items:center;gap:5px;cursor:pointer;">
            <div style="
              width:26px;height:26px;border-radius:50%;
              background:${color}22;border:2px solid ${color};
              display:flex;align-items:center;justify-content:center;
              font-size:12px;flex-shrink:0;${staleRing}
            ">${typeIcon(e.type)}</div>
            <div style="
              background:rgba(6,14,28,0.92);border:1px solid rgba(0,229,255,0.2);
              padding:3px 8px;border-radius:3px;white-space:nowrap;
            ">
              <div style="font-size:11px;font-weight:700;color:#fff;font-family:Inter,sans-serif;">${e.name}</div>
              <div style="font-size:10px;color:${color};font-weight:600;font-family:Inter,sans-serif;">${e.current_state}${e.is_stale ? ' · ⚠' : ''}</div>
            </div>
          </div>`;
        const icon = L.divIcon({ html, className: '', iconSize: [150, 34] });
        L.marker([e.location.lat, e.location.lng], { icon })
          .on('click', () => onSelectEntity(e))
          .addTo(layers.current.markers);
      });
    }

    // Incidents
    if (activeLayers.incidents && areaData?.incidents) {
      areaData.incidents.forEach(inc => {
        const html = `
          <div style="display:flex;align-items:center;gap:5px;">
            <div style="
              width:26px;height:26px;border-radius:50%;
              background:#dc262622;border:2px solid #dc2626;
              display:flex;align-items:center;justify-content:center;font-size:12px;
            ">🚨</div>
            <div style="
              background:rgba(6,14,28,0.92);border:1px solid rgba(239,68,68,0.3);
              padding:3px 8px;border-radius:3px;white-space:nowrap;
            ">
              <div style="font-size:11px;font-weight:700;color:#fff;font-family:Inter,sans-serif;">${inc.name}</div>
              <div style="font-size:10px;color:#fca5a5;font-weight:600;font-family:Inter,sans-serif;">${inc.severity} SEVERITY</div>
            </div>
          </div>`;
        L.marker([inc.location.lat, inc.location.lng], {
          icon: L.divIcon({ html, className: '', iconSize: [140, 34] }),
        }).addTo(layers.current.markers);
      });
    }

    // Field units
    if (activeLayers.field_units && areaData?.field_units) {
      areaData.field_units.forEach(u => {
        const html = `
          <div style="display:flex;align-items:center;gap:5px;">
            <div style="
              width:26px;height:26px;border-radius:50%;
              background:#2563eb22;border:2px solid #2563eb;
              display:flex;align-items:center;justify-content:center;font-size:12px;
            ">📱</div>
            <div style="
              background:rgba(6,14,28,0.92);border:1px solid rgba(37,99,235,0.3);
              padding:3px 8px;border-radius:3px;white-space:nowrap;
            ">
              <div style="font-size:11px;font-weight:700;color:#fff;font-family:Inter,sans-serif;">${u.callsign}</div>
              <div style="font-size:10px;color:#93c5fd;font-weight:600;font-family:Inter,sans-serif;">${u.status}</div>
            </div>
          </div>`;
        L.marker([u.location.lat, u.location.lng], {
          icon: L.divIcon({ html, className: '', iconSize: [130, 34] }),
        }).addTo(layers.current.markers);
      });
    }
  }, [entities, areaData, activeLayers, onSelectEntity]);

  // Resize observer to ensure Leaflet renders edge-to-edge on full-screen / idle transition
  useEffect(() => {
    if (!mapInst.current || !mapRef.current) return;
    const observer = new ResizeObserver(() => {
      mapInst.current?.invalidateSize();
    });
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      <style>{`
        .eoc-tooltip {
          background: rgba(6,14,28,0.95) !important;
          border: 1px solid rgba(0,229,255,0.3) !important;
          color: #c8d9f0 !important;
          font-family: Inter, sans-serif !important;
          font-size: 12px !important;
          padding: 4px 10px !important;
          border-radius: 3px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
        }
        .eoc-tooltip::before { display: none !important; }
        .leaflet-container { background: #030712; }
      `}</style>
    </div>
  );
}

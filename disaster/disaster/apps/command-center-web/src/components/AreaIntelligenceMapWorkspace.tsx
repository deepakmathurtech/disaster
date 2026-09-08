import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Entity, Conflict, AreaIntelligence } from '../App';

interface MapProps {
  areaData: AreaIntelligence | null;
  entities: Entity[];
  conflicts: Conflict[];
  activeLayers: {
    red_alert: boolean;
    infrastructure: boolean;
    water_sources: boolean;
    incidents: boolean;
    field_units: boolean;
    uncertainty: boolean;
    flood_exposure: boolean;
  };
  onSelectEntity: (e: Entity) => void;
  onSelectIncident?: (inc: any) => void;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const stateColor = (state: string) => {
  if (!state) return '#38bdf8';
  const s = state.toUpperCase();
  if (s === 'OPERATIONAL' || s === 'OPEN' || s === 'SAFE' || s === 'ACTIVE') return '#10b981';
  if (
    s === 'BLOCKED' || s === 'DAMAGED' || s === 'CRITICAL' ||
    s.includes('COLLAPSE') || s.includes('WASH') || s.includes('BREACH') ||
    s.includes('SUBMERGE') || s.includes('INUNDAT') || s.includes('DANGER') ||
    s.includes('FLOOD')
  ) return '#ef4444';
  if (s.includes('PARTIAL') || s.includes('WARN') || s.includes('RISK') || s.includes('STANDBY')) return '#f59e0b';
  return '#38bdf8';
};

const typeIcon = (type: string) => {
  const t = (type || '').toUpperCase();
  if (t.includes('BRIDGE') || t.includes('FOOTBRIDGE')) return '🌉';
  if (t.includes('ROAD') || t.includes('HIGHWAY')) return '🛣';
  if (t.includes('EMBANK') || t.includes('DAM') || t.includes('DRAIN')) return '🛡';
  if (t.includes('SHELTER')) return '🏠';
  if (t.includes('HOSPITAL') || t.includes('CLINIC') || t.includes('MEDICAL')) return '🏥';
  if (t.includes('GAUGE') || t.includes('RIVER') || t.includes('WATER')) return '🌊';
  if (t.includes('URBAN') || t.includes('TOWN') || t.includes('CITY')) return '🏙';
  if (t.includes('INCIDENT') || t.includes('FIRE')) return '⚠';
  return '🏗';
};

export default function AreaIntelligenceMapWorkspace({
  areaData, entities, conflicts, activeLayers, onSelectEntity, onSelectIncident,
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
    layers.current.red_alert = L.layerGroup().addTo(map);
    layers.current.uncertain = L.layerGroup().addTo(map);
    layers.current.markers   = L.layerGroup().addTo(map);

    mapInst.current = map;
    return () => { map.remove(); mapInst.current = null; };
  }, []);

  // Fly to area on change
  useEffect(() => {
    if (!mapInst.current || !areaData) return;
    const { center, boundary_polygon } = areaData.area;
    const locations: [number, number][] = [
      ...(boundary_polygon ?? []),
      ...areaData.water_sources.map(w => [w.location.lat, w.location.lng] as [number, number]),
      ...entities.map(e => [e.location.lat, e.location.lng] as [number, number]),
    ].filter(loc => loc && typeof loc[0] === 'number' && typeof loc[1] === 'number' && !isNaN(loc[0]) && !isNaN(loc[1]));

    if (locations.length > 1) {
      mapInst.current.fitBounds(L.latLngBounds(locations), {
        padding: [35, 35],
        maxZoom: 13,
        animate: true,
        duration: 1.2,
      });
    } else {
      mapInst.current.flyTo([center.lat, center.lng], 10, { duration: 1.2, easeLinearity: 0.2 });
    }

    layers.current.boundary?.clearLayers();
    if (boundary_polygon?.length) {
      L.polygon(boundary_polygon as [number, number][], {
        color: '#38bdf8', weight: 1.5, dashArray: '6 4',
        fillColor: '#38bdf8', fillOpacity: 0.04,
      }).addTo(layers.current.boundary);
    }
  }, [areaData, entities]);

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

  // Red Alert Zones Layer (Nagaon, Golaghat, Sivasagar, Jorhat, Hojai, etc.)
  useEffect(() => {
    layers.current.red_alert?.clearLayers();
    if (!areaData || !activeLayers.red_alert) return;

    const redAlertZones = (areaData.red_alert_zones && areaData.red_alert_zones.length > 0)
      ? areaData.red_alert_zones
      : (areaData.area.id === 'assam-demo' ? [
          {
            id: 'ra-nagaon',
            name: 'Nagaon Flood Inundation Zone',
            district: 'Nagaon',
            severity: 'RED_ALERT',
            location: { lat: 26.3452, lng: 92.6840 },
            radius_meters: 7500,
            impact_description: 'Severe Brahmaputra backflow flood. 70+ villages submerged, critical transit cut off.',
            affected_population: '145,000+',
            evacuation_status: 'Mandatory Tier-1 Evacuation Active',
          },
          {
            id: 'ra-golaghat',
            name: 'Golaghat High-Risk Surge Zone',
            district: 'Golaghat',
            severity: 'RED_ALERT',
            location: { lat: 26.5167, lng: 93.9667 },
            radius_meters: 6800,
            impact_description: 'Dhansiri river water flowing 1.8m above danger mark. Major highways inundated.',
            affected_population: '98,000+',
            evacuation_status: 'Active Riverbank Evacuations',
          },
          {
            id: 'ra-sivasagar',
            name: 'Sivasagar Submerged Urban & Rural Zone',
            district: 'Sivasagar',
            severity: 'RED_ALERT',
            location: { lat: 26.9850, lng: 94.6300 },
            radius_meters: 6200,
            impact_description: 'Multiple embankment breaches on Jhanji & Dikhow rivers. Town core waterlogged.',
            affected_population: '120,000+',
            evacuation_status: 'Boat Rescues Deployed',
          },
          {
            id: 'ra-jorhat',
            name: 'Jorhat / Teok Inundation Belt',
            district: 'Jorhat',
            severity: 'RED_ALERT',
            location: { lat: 26.7509, lng: 94.2037 },
            radius_meters: 6500,
            impact_description: 'National highway corridor flooded. Heavy crop & critical infrastructure damage.',
            affected_population: '85,000+',
            evacuation_status: 'Relief Camps Activated',
          },
          {
            id: 'ra-hojai',
            name: 'Hojai Flash Flood Danger Zone',
            district: 'Hojai',
            severity: 'RED_ALERT',
            location: { lat: 26.0000, lng: 92.8600 },
            radius_meters: 5800,
            impact_description: 'Kopili river torrential surge. Low-lying habitations cut off from power grid.',
            affected_population: '62,000+',
            evacuation_status: 'Evacuation in Progress',
          },
        ] : []);

    redAlertZones.forEach(zone => {
      // Danger zone perimeter buffer
      L.circle([zone.location.lat, zone.location.lng], {
        radius: zone.radius_meters,
        color: '#ef4444',
        weight: 2,
        dashArray: '5 5',
        fillColor: '#dc2626',
        fillOpacity: 0.16,
      }).addTo(layers.current.red_alert);

      // Inner high danger core
      L.circle([zone.location.lat, zone.location.lng], {
        radius: Math.floor(zone.radius_meters * 0.4),
        color: '#b91c1c',
        weight: 1.5,
        fillColor: '#ef4444',
        fillOpacity: 0.28,
      }).addTo(layers.current.red_alert);

      // Red Alert pulsating marker badge
      const html = `
        <div class="red-alert-marker-pulse" style="
          width: 34px; height: 34px; border-radius: 50%;
          background: rgba(185, 28, 28, 0.45); border: 2px solid #ef4444;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; cursor: pointer;
          box-shadow: 0 0 16px rgba(239, 68, 68, 0.85);
          user-select: none;
        ">🛑</div>`;

      const marker = L.marker([zone.location.lat, zone.location.lng], {
        icon: L.divIcon({ html, className: 'red-alert-div-icon', iconSize: [34, 34], iconAnchor: [17, 17] }),
      });

      marker.bindTooltip(
        `<div style="min-width:190px;">
          <div style="font-weight:800;color:#ff4d4d;font-size:12px;font-family:Inter,sans-serif;display:flex;align-items:center;gap:4px;">
            <span>🛑 RED ALERT: ${zone.district || zone.name}</span>
          </div>
          <div style="font-size:11px;font-weight:700;color:#ffffff;margin-top:3px;font-family:Inter,sans-serif;">
            ${zone.name}
          </div>
          <div style="font-size:10px;color:#fca5a5;margin-top:3px;line-height:1.35;font-family:Inter,sans-serif;">
            ${zone.impact_description}
          </div>
          <div style="font-size:9.5px;color:#fef08a;margin-top:4px;font-weight:600;font-family:Inter,sans-serif;">
            👥 At Risk: ${zone.affected_population || 'High'} &middot; ${zone.evacuation_status || 'Evacuations Active'}
          </div>
          <div style="font-size:9px;color:#93c5fd;margin-top:4px;font-weight:600;font-family:Inter,sans-serif;">
            → Click to trigger Tactical AI Response
          </div>
        </div>`,
        { className: 'eoc-tooltip red-alert-tooltip', direction: 'top', offset: [0, -14] }
      );

      marker.on('click', () => {
        if (onSelectIncident) {
          onSelectIncident({
            id: zone.id,
            name: `RED ALERT: ${zone.name}`,
            sev: 'CRITICAL',
            sub: `${zone.district || 'Assam'} Sector &middot; At Risk: ${zone.affected_population || 'High'}`,
            time: 'RED ALERT ACTIVE',
            icon: '🛑',
          });
        }
      });

      marker.addTo(layers.current.red_alert);
    });
  }, [areaData, activeLayers.red_alert, onSelectIncident]);

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

    // Infrastructure entities - Clean circular symbol badge with hover tooltip & click to open inspector
    if (activeLayers.infrastructure) {
      entities.forEach(e => {
        if (!e.location || typeof e.location.lat !== 'number' || typeof e.location.lng !== 'number') return;
        const color = stateColor(e.current_state);
        const staleRing = e.is_stale ? 'box-shadow: 0 0 0 2.5px #f59e0b, 0 0 12px rgba(245,158,11,0.6);' : `box-shadow: 0 0 10px ${color}66;`;
        const html = `
          <div class="infra-badge-marker" style="
            width: 30px; height: 30px; border-radius: 50%;
            background: ${color}28; border: 2px solid ${color};
            display: flex; align-items: center; justify-content: center;
            font-size: 14px; cursor: pointer;
            ${staleRing}
            user-select: none;
          ">${typeIcon(e.type)}</div>`;
        const icon = L.divIcon({ html, className: 'infra-div-icon', iconSize: [30, 30], iconAnchor: [15, 15] });
        const marker = L.marker([e.location.lat, e.location.lng], { icon });

        marker.bindTooltip(
          `<div>
            <div style="font-weight:700;color:#fff;font-size:12px;font-family:Inter,sans-serif;">${typeIcon(e.type)} ${e.name}</div>
            <div style="font-size:10px;color:${color};font-weight:600;font-family:Inter,sans-serif;margin-top:2px;">
              ${e.current_state}${e.is_stale ? ' &middot; ⚠ STALE' : ''} &middot; ${(e.confidence * 100).toFixed(0)}% Confidence
            </div>
            ${e.location.address ? `<div style="font-size:9.5px;color:#94a3b8;margin-top:2px;">${e.location.address}</div>` : ''}
          </div>`,
          { className: 'eoc-tooltip', direction: 'top', offset: [0, -10] }
        );

        marker.on('click', () => onSelectEntity(e));
        marker.addTo(layers.current.markers);
      });
    }

    // Incidents - Compact symbol icon with hover tooltip and click-to-open window
    if (activeLayers.incidents && areaData?.incidents) {
      areaData.incidents.forEach(inc => {
        if (!inc.location || typeof inc.location.lat !== 'number' || typeof inc.location.lng !== 'number') return;
        const html = `
          <div class="incident-badge-marker" style="
            width: 32px; height: 32px; border-radius: 50%;
            background: rgba(220, 38, 38, 0.35); border: 2px solid #ef4444;
            display: flex; align-items: center; justify-content: center;
            font-size: 15px; cursor: pointer;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.7);
            user-select: none;
          ">🚨</div>`;
        const marker = L.marker([inc.location.lat, inc.location.lng], {
          icon: L.divIcon({ html, className: 'inc-div-icon', iconSize: [32, 32], iconAnchor: [16, 16] }),
        });

        marker.bindTooltip(
          `<div>
            <div style="font-weight:700;color:#fff;font-size:12px;font-family:Inter,sans-serif;">🚨 ${inc.name}</div>
            <div style="font-size:10px;color:#fca5a5;font-weight:600;font-family:Inter,sans-serif;">${inc.severity} SEVERITY &middot; Click to inspect</div>
          </div>`,
          { className: 'eoc-tooltip', direction: 'top', offset: [0, -12] }
        );

        marker.on('click', () => {
          if (onSelectIncident) {
            onSelectIncident({
              id: inc.id || `inc-${Date.now()}`,
              name: inc.name,
              sev: (inc.severity || 'high').toLowerCase(),
              sub: `${areaData?.area.name || 'Operations Zone'} Sector`,
              time: 'Active Alert',
              icon: '🚨',
            });
          }
        });

        marker.addTo(layers.current.markers);
      });
    }

    // Field units - Clean circular badge with hover tooltip
    if (activeLayers.field_units && areaData?.field_units) {
      areaData.field_units.forEach(u => {
        if (!u.location || typeof u.location.lat !== 'number' || typeof u.location.lng !== 'number') return;
        const html = `
          <div class="unit-badge-marker" style="
            width: 28px; height: 28px; border-radius: 50%;
            background: rgba(37, 99, 235, 0.25); border: 2px solid #38bdf8;
            display: flex; align-items: center; justify-content: center;
            font-size: 13px; cursor: pointer;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
            user-select: none;
          ">📱</div>`;
        const marker = L.marker([u.location.lat, u.location.lng], {
          icon: L.divIcon({ html, className: 'unit-div-icon', iconSize: [28, 28], iconAnchor: [14, 14] }),
        });

        marker.bindTooltip(
          `<div>
            <div style="font-weight:700;color:#fff;font-size:12px;font-family:Inter,sans-serif;">📱 ${u.callsign}</div>
            <div style="font-size:10px;color:#93c5fd;font-weight:600;font-family:Inter,sans-serif;">${u.status}</div>
          </div>`,
          { className: 'eoc-tooltip', direction: 'top', offset: [0, -10] }
        );

        marker.addTo(layers.current.markers);
      });
    }
  }, [entities, areaData, activeLayers, onSelectEntity, onSelectIncident]);

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
        @keyframes incPulseAnimation {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8), 0 0 10px rgba(239, 68, 68, 0.5); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0), 0 0 18px rgba(239, 68, 68, 0.8); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0), 0 0 10px rgba(239, 68, 68, 0.5); }
        }
        @keyframes redAlertPulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 30, 30, 0.9), 0 0 16px rgba(239, 68, 68, 0.8); }
          70% { box-shadow: 0 0 0 14px rgba(255, 30, 30, 0), 0 0 24px rgba(239, 68, 68, 0.95); }
          100% { box-shadow: 0 0 0 0 rgba(255, 30, 30, 0), 0 0 16px rgba(239, 68, 68, 0.8); }
        }
        .red-alert-marker-pulse {
          animation: redAlertPulse 1.5s infinite;
          transition: transform 0.15s ease;
        }
        .incident-badge-marker {
          animation: incPulseAnimation 1.8s infinite;
          transition: transform 0.15s ease;
        }
        .incident-badge-marker:hover, .infra-badge-marker:hover, .unit-badge-marker:hover, .red-alert-marker-pulse:hover {
          transform: scale(1.22);
        }
        .infra-badge-marker, .unit-badge-marker {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .inc-div-icon, .infra-div-icon, .unit-div-icon, .red-alert-div-icon {
          background: transparent !important;
          border: none !important;
        }
        .eoc-tooltip {
          background: rgba(6,14,28,0.96) !important;
          border: 1px solid rgba(0,229,255,0.3) !important;
          color: #c8d9f0 !important;
          font-family: Inter, sans-serif !important;
          font-size: 12px !important;
          padding: 5px 10px !important;
          border-radius: 4px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
          line-height: 1.35;
        }
        .red-alert-tooltip {
          border: 1.5px solid rgba(239, 68, 68, 0.7) !important;
          box-shadow: 0 4px 24px rgba(239, 68, 68, 0.45) !important;
        }
        .eoc-tooltip::before { display: none !important; }
        .leaflet-container { background: #030712; }
      `}</style>
    </div>
  );
}

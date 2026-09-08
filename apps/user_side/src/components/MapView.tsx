import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, ShieldCheck, AlertTriangle, Compass, Navigation } from 'lucide-react';
import { RouteDetail, RouteSearchResponse, RoadNode } from '@disaster/protocol';
import MapControls from './MapControls';
import { fetchRouteNodes, fetchSafeRoutes } from '../services/api';
import { UserView } from './BottomFloatingDock';

interface MapViewProps {
  userLocation: { lat: number; lng: number; addressName: string };
  onBack: () => void;
}

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const DEFAULT_NODES: RoadNode[] = [
  { id: 'node-shelter-alpha', name: 'Central High Shelter', lat: 12.9785, lng: 77.5980, type: 'SHELTER' },
  { id: 'node-hospital-main', name: 'Sector Memorial Hospital', lat: 12.9710, lng: 77.6010, type: 'HOSPITAL' },
  { id: 'node-red-fort', name: 'High Ground Emergency Refuge', lat: 12.9820, lng: 77.5890, type: 'SHELTER' },
];

export const MapView: React.FC<MapViewProps> = ({ userLocation, onBack }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map | null>(null);
  const [mapState, setMapState] = useState<L.Map | null>(null);
  const layers = useRef<Record<string, L.LayerGroup>>({});

  const [areaId, setAreaId] = useState<string>('sector-4-demo');
  const [nodes, setNodes] = useState<RoadNode[]>(DEFAULT_NODES);
  const [selectedShelterId, setSelectedShelterId] = useState<string>('node-shelter-alpha');
  const [routes, setRoutes] = useState<RouteDetail[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [routeResponse, setRouteResponse] = useState<RouteSearchResponse | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState<boolean>(false);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;

    // Prevent Leaflet "Map container is already initialized" crash in React 18/Strict Mode
    if ((mapRef.current as any)._leaflet_id) {
      delete (mapRef.current as any)._leaflet_id;
    }

    let map: L.Map;
    try {
      map = L.map(mapRef.current, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });
    } catch (err) {
      console.warn('Leaflet map init warning:', err);
      return;
    }

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    layers.current.routes = L.layerGroup().addTo(map);
    layers.current.shelters = L.layerGroup().addTo(map);
    layers.current.hazards = L.layerGroup().addTo(map);
    layers.current.user = L.layerGroup().addTo(map);

    mapInst.current = map;
    setMapState(map);

    // Repeated size invalidation to fix Leaflet 0-height container initial calculation bug
    const intervalTimer = setInterval(() => {
      map.invalidateSize();
    }, 200);

    const stopTimer = setTimeout(() => {
      clearInterval(intervalTimer);
    }, 2500);

    return () => {
      clearInterval(intervalTimer);
      clearTimeout(stopTimer);
      map.remove();
      mapInst.current = null;
      setMapState(null);
    };
  }, []);

  // Render User Marker
  useEffect(() => {
    if (!layers.current.user) return;
    layers.current.user.clearLayers();

    const userIcon = L.divIcon({
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(0,229,255,0.25);animation:pulseRing 2s infinite;"></div>
          <div style="width:18px;height:18px;border-radius:50%;background:#00e5ff;border:3px solid #ffffff;box-shadow:0 0 12px #00e5ff;"></div>
        </div>
      `,
      className: '',
      iconSize: [34, 34],
    });

    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
      .bindTooltip(`📍 YOU ARE HERE (${userLocation.addressName})`, { permanent: true, direction: 'top', className: 'citizen-map-tooltip' })
      .addTo(layers.current.user);
  }, [userLocation]);

  // Load Road Nodes & Shelters
  useEffect(() => {
    fetchRouteNodes(areaId).then((fetchedNodes) => {
      if (fetchedNodes && fetchedNodes.length > 0) {
        setNodes(fetchedNodes);
        const shelter = fetchedNodes.find(n => n.type === 'SHELTER' || n.id.includes('shelter')) || fetchedNodes[0];
        setSelectedShelterId(shelter.id);
      } else {
        setNodes(DEFAULT_NODES);
      }
    }).catch(() => {
      setNodes(DEFAULT_NODES);
    });
  }, [areaId]);

  // Render Shelters & Hazard Markers on Map
  useEffect(() => {
    if (!layers.current.shelters || !layers.current.hazards) return;
    layers.current.shelters.clearLayers();
    layers.current.hazards.clearLayers();

    // Render Shelters
    nodes.filter(n => n.type === 'SHELTER' || n.type === 'HOSPITAL').forEach((node) => {
      const isSelected = node.id === selectedShelterId;
      const isShelter = node.type === 'SHELTER';
      const color = isShelter ? '#10b981' : '#38bdf8';

      const shelterIcon = L.divIcon({
        html: `
          <div style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <div style="width:28px;height:28px;border-radius:50%;background:${color};color:#000;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;border:2px solid #fff;box-shadow:0 0 ${isSelected ? '14px' : '6px'} ${color};">
              ${isShelter ? '🏠' : '🏥'}
            </div>
            <div style="background:rgba(6,14,28,0.92);border:1px solid ${isSelected ? color : 'rgba(255,255,255,0.2)'};padding:4px 8px;border-radius:4px;white-space:nowrap;color:#fff;font-size:11px;font-weight:700;">
              ${node.name} ${isSelected ? '✓ SELECTED' : ''}
            </div>
          </div>
        `,
        className: '',
        iconSize: [160, 32],
      });

      L.marker([node.lat, node.lng], { icon: shelterIcon })
        .on('click', () => setSelectedShelterId(node.id))
        .addTo(layers.current.shelters);
    });

    // Render Hazard Zones (Bridge B12 Damaged / Impassable areas)
    const hazardCoords: [number, number, string][] = [
      [12.9716, 77.5946, '🌉 BRIDGE B12 — STRUCTURAL DAMAGE / IMPASSABLE'],
      [12.9650, 77.5900, '🌊 COASTAL JUNCTION — HIGH WATER / BLOCKED'],
    ];

    hazardCoords.forEach(([lat, lng, desc]) => {
      L.circle([lat, lng], {
        radius: 250,
        color: '#ef4444',
        weight: 2,
        dashArray: '6 6',
        fillColor: '#ef4444',
        fillOpacity: 0.25,
      })
        .bindTooltip(`⚠️ DANGER: ${desc}`, { className: 'citizen-hazard-tooltip' })
        .addTo(layers.current.hazards);
    });
  }, [nodes, selectedShelterId]);

  // Handle Safe Route Calculation via Server API
  const handleCalculateSafeRoute = async () => {
    setIsLoadingRoutes(true);
    const startNode = nodes.find(n => n.type === 'CHECKPOINT') || nodes[0];
    const fromId = startNode ? startNode.id : 'node-south-entry';

    const response = await fetchSafeRoutes(areaId, fromId, selectedShelterId);
    if (response && response.routes && response.routes.length > 0) {
      // Sort routes prioritizing SAFETY over raw distance!
      const sortedBySafety = [...response.routes].sort((a, b) => {
        const safetyRank = { safe: 1, cautious: 2, dangerous: 3 };
        return safetyRank[a.safety] - safetyRank[b.safety];
      });

      setRouteResponse(response);
      setRoutes(sortedBySafety);
      setSelectedRouteId(sortedBySafety[0].routeId);
    } else {
      // Offline mock fallback if server API is warming up
      const fallbackRoutes: RouteDetail[] = [
        {
          routeId: 1,
          name: 'West Perimeter Safe Bypass Corridor',
          distanceKm: 3.4,
          estimatedTimeMin: 4.2,
          traffic: 'low',
          safety: 'safe',
          routeLengthClassification: 'medium',
          color: '#10b981',
          pathNodeIds: ['node-south-entry', 'node-west-ring', 'node-shelter-alpha'],
          coordinates: [
            { lat: userLocation.lat, lng: userLocation.lng },
            { lat: 12.9660, lng: 77.5870 },
            { lat: 12.9720, lng: 77.5860 },
            { lat: 12.9785, lng: 77.5980 },
          ],
          segments: [],
        },
        {
          routeId: 2,
          name: 'Bridge B12 Direct Approach (HAZARD WARNING)',
          distanceKm: 3.1,
          estimatedTimeMin: 6.8,
          traffic: 'heavy',
          safety: 'dangerous',
          routeLengthClassification: 'short',
          color: '#ef4444',
          pathNodeIds: ['node-south-entry', 'node-bridge-b12', 'node-shelter-alpha'],
          coordinates: [
            { lat: userLocation.lat, lng: userLocation.lng },
            { lat: 12.9716, lng: 77.5946 },
            { lat: 12.9785, lng: 77.5980 },
          ],
          segments: [],
        },
      ];
      setRoutes(fallbackRoutes);
      setSelectedRouteId(1);
    }
    setIsLoadingRoutes(false);
  };

  // Render Routes on Leaflet Map
  useEffect(() => {
    if (!layers.current.routes || routes.length === 0) return;
    layers.current.routes.clearLayers();

    routes.forEach((r) => {
      const isSelected = selectedRouteId === r.routeId;
      const isSafe = r.safety === 'safe';
      const color = isSafe ? '#10b981' : r.safety === 'cautious' ? '#f59e0b' : '#ef4444';

      const latLngs = r.coordinates.map((c) => [c.lat, c.lng] as [number, number]);

      const polyline = L.polyline(latLngs, {
        color: color,
        weight: isSelected ? 8 : 4,
        opacity: isSelected ? 0.95 : 0.45,
        dashArray: isSelected && !isSafe ? '8 6' : undefined,
      });

      polyline.bindTooltip(
        `<b>ROUTE ${r.routeId}: ${r.name}</b><br/>Safety: ${r.safety.toUpperCase()} | Time: ${Math.round(r.estimatedTimeMin)}m`,
        { className: 'citizen-map-tooltip', sticky: true }
      );

      polyline.on('click', () => setSelectedRouteId(r.routeId));
      polyline.addTo(layers.current.routes);
    });
  }, [routes, selectedRouteId]);

  const activeRoute = routes.find(r => r.routeId === selectedRouteId) || routes[0];

  return (
    <div className="map-view-fullscreen">
      {/* Top Focused Navigation Bar */}
      <div className="map-top-bar">
        <button type="button" className="btn-back-sos" onClick={onBack} aria-label="Back to SOS Home">
          <ArrowLeft size={20} />
        </button>
        <div className="map-title-badge">
          <ShieldCheck size={18} className="icon-emerald" />
          <span>SAFE SHELTER NAVIGATION</span>
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div
        ref={mapRef}
        className="map-canvas-container"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          background: '#e2e8f0',
        }}
      />
      <MapControls map={mapState} />

      {/* Bottom Safe Route Action & Info Panel */}
      <div className="map-bottom-panel">
        <div className="shelter-selector-row">
          <label htmlFor="shelter-target-select">DESTINATION SHELTER:</label>
          <select
            id="shelter-target-select"
            value={selectedShelterId}
            onChange={(e) => setSelectedShelterId(e.target.value)}
            className="shelter-select-input"
          >
            {nodes.filter(n => n.type === 'SHELTER' || n.type === 'HOSPITAL').length > 0 ? (
              nodes.filter(n => n.type === 'SHELTER' || n.type === 'HOSPITAL').map(node => (
                <option key={node.id} value={node.id}>
                  {node.type === 'HOSPITAL' ? '🏥' : '🏠'} {node.name}
                </option>
              ))
            ) : (
              <>
                <option value="node-shelter-alpha">🏠 Central High Shelter (Capacity: 85% Safe)</option>
                <option value="node-hospital-main">🏥 Sector Memorial Hospital (Medical Point)</option>
                <option value="node-red-fort">🏠 High Ground Emergency Refuge</option>
              </>
            )}
          </select>

          <button
            type="button"
            className="btn-find-safe-route"
            onClick={handleCalculateSafeRoute}
            disabled={isLoadingRoutes}
          >
            {isLoadingRoutes ? 'CALCULATING SAFE PATH...' : <><Navigation size={18} /> FIND SAFE ROUTE</>}
          </button>
        </div>

        {activeRoute && (
          <div className={`active-route-summary-card ${activeRoute.safety}`}>
            <div className="route-card-header">
              <div className="route-badge-title">
                <span className={`safety-badge ${activeRoute.safety}`}>
                  {activeRoute.safety === 'safe' ? '✓ RECOMMENDED SAFE ROUTE' : '⚠️ HAZARD ON PATH'}
                </span>
                <span className="route-name-text">{activeRoute.name}</span>
              </div>
              <div className="route-stats">
                <span className="stat-time">{Math.round(activeRoute.estimatedTimeMin)} MINS</span>
                <span className="stat-dist">{Number(activeRoute.distanceKm.toFixed(1))} KM</span>
              </div>
            </div>

            <div className="route-safety-note">
              {activeRoute.safety === 'safe' ? (
                <span>🛡️ <b>PRIORITIZES SAFETY:</b> Bypasses flooded Bridge B12 and high-water coastal causeways.</span>
              ) : (
                <span>⚠️ <b>HAZARD ADVISORY:</b> Shortest path passes near damaged infrastructure. Proceed with caution.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

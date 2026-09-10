import React, { useState, useEffect } from 'react';
import { RoadNode, RouteDetail, RouteSearchResponse, AIRouteInsight } from '@disaster/protocol';

interface RouteFinderWindowProps {
  serverUrl: string;
  areaId?: string;
  onRoutesCalculated: (routes: RouteDetail[], selectedId: number | null) => void;
  selectedRouteId: number | null;
  onSelectRoute: (id: number) => void;
  onDispatchTask?: (taskTitle: string, entityId: string) => void;
}

// ─── Offline Fallback Datasets for Area Switching ──────────────────────
const DELHI_FALLBACK_NODES: RoadNode[] = [
  { id: 'node-delhi-cp', name: 'Connaught Place (Central Hub)', lat: 28.6315, lng: 77.2167, type: 'CHECKPOINT' },
  { id: 'node-delhi-india-gate', name: 'India Gate Hexagon', lat: 28.6129, lng: 77.2295, type: 'WAYPOINT' },
  { id: 'node-delhi-ito', name: 'ITO Chowk Junction', lat: 28.6280, lng: 77.2400, type: 'INTERSECTION' },
  { id: 'node-delhi-loha-pul', name: 'Old Yamuna Bridge (Loha Pul)', lat: 28.6200, lng: 77.2350, type: 'INTERSECTION' },
  { id: 'node-delhi-red-fort', name: 'Red Fort Emergency Shelter', lat: 28.6562, lng: 77.2410, type: 'SHELTER' },
  { id: 'node-delhi-aiims', name: 'AIIMS Trauma Center', lat: 28.5672, lng: 77.2100, type: 'HOSPITAL' },
  { id: 'node-delhi-ring-road', name: 'Ring Road Outer Corridor', lat: 28.6050, lng: 77.2100, type: 'INTERSECTION' },
  { id: 'node-delhi-kashmere-gate', name: 'Kashmere Gate Transit Hub', lat: 28.6665, lng: 77.2285, type: 'CHECKPOINT' },
];

const SECTOR4_FALLBACK_NODES: RoadNode[] = [
  { id: 'node-south-entry', name: 'South Gate (Main Entry)', lat: 12.9600, lng: 77.5900, type: 'CHECKPOINT' },
  { id: 'node-coastal-jct', name: 'Coastal Junction', lat: 12.9650, lng: 77.5900, type: 'INTERSECTION' },
  { id: 'node-bridge-b12', name: 'Bridge B12 Approach', lat: 12.9716, lng: 77.5946, type: 'INTERSECTION' },
  { id: 'node-shelter-alpha', name: 'Central High Shelter', lat: 12.9785, lng: 77.5980, type: 'SHELTER' },
  { id: 'node-hospital-main', name: 'Sector Memorial Hospital', lat: 12.9750, lng: 77.6020, type: 'HOSPITAL' },
  { id: 'node-east-express', name: 'East Sector Bypass', lat: 12.9680, lng: 77.6050, type: 'INTERSECTION' },
  { id: 'node-west-ring', name: 'West Perimeter Ring', lat: 12.9720, lng: 77.5860, type: 'INTERSECTION' },
  { id: 'node-north-basin', name: 'North River Basin Waypoint', lat: 12.9810, lng: 77.5910, type: 'WAYPOINT' },
];

const ASSAM_FALLBACK_NODES: RoadNode[] = [
  { id: 'node-assam-guwahati-entry', name: 'Guwahati Relief Entry', lat: 26.1445, lng: 91.7362, type: 'CHECKPOINT' },
  { id: 'node-assam-brahmaputra', name: 'Brahmaputra Embankment', lat: 26.1850, lng: 91.7450, type: 'INTERSECTION' },
  { id: 'node-assam-shelter', name: 'Kamrup Flood Shelter', lat: 26.1580, lng: 91.7800, type: 'SHELTER' },
  { id: 'node-assam-hospital', name: 'Guwahati Emergency Hospital', lat: 26.1500, lng: 91.7700, type: 'HOSPITAL' },
  { id: 'node-assam-highway', name: 'NH-27 High Ground Bypass', lat: 26.1300, lng: 91.7000, type: 'WAYPOINT' },
];

function generateOfflineAreaRoutes(nodes: RoadNode[], areaLabel: string): RouteDetail[] {
  const source = nodes[0];
  const destination = nodes.find(node => node.type === 'SHELTER' || node.type === 'HOSPITAL') || nodes[nodes.length - 1];
  const waypoint = nodes[1] || source;
  const coordinates = [source, waypoint, destination].map(node => ({ lat: node.lat, lng: node.lng }));
  return [
    {
      routeId: 1, name: `${areaLabel} high-ground evacuation route`, distanceKm: 4.2, estimatedTimeMin: 8,
      traffic: 'moderate', safety: 'safe', routeLengthClassification: 'medium', color: '#10b981',
      pathNodeIds: [source.id, waypoint.id, destination.id], coordinates, segments: [],
    },
    {
      routeId: 2, name: `${areaLabel} riverside response route`, distanceKm: 3.1, estimatedTimeMin: 6,
      traffic: 'heavy', safety: 'cautious', routeLengthClassification: 'short', color: '#f59e0b',
      pathNodeIds: [source.id, destination.id], coordinates: [coordinates[0], coordinates[2]], segments: [],
    },
  ];
}

function generateOfflineDelhiRoutes(): RouteDetail[] {
  return [
    {
      routeId: 1,
      name: 'Route 1 via Netaji Subhash Marg Direct',
      distanceKm: 3.4,
      estimatedTimeMin: 4.1,
      traffic: 'low',
      safety: 'safe',
      routeLengthClassification: 'short',
      color: '#ef4444',
      pathNodeIds: ['node-delhi-cp', 'node-delhi-ito', 'node-delhi-red-fort'],
      coordinates: [
        { lat: 28.6315, lng: 77.2167 },
        { lat: 28.6280, lng: 77.2400 },
        { lat: 28.6420, lng: 77.2405 },
        { lat: 28.6562, lng: 77.2410 },
      ],
      segments: [
        { edgeId: 'edge-delhi-cp-ito', roadName: 'Barakhamba Emergency Arterial', penaltyMultiplier: 1 },
        { edgeId: 'edge-delhi-ito-redfort', roadName: 'Netaji Subhash Marg', penaltyMultiplier: 1 },
      ],
    },
    {
      routeId: 2,
      name: 'Route 2 via Janpath & India Gate Hexagon',
      distanceKm: 4.1,
      estimatedTimeMin: 4.8,
      traffic: 'low',
      safety: 'safe',
      routeLengthClassification: 'medium',
      color: '#10b981',
      pathNodeIds: ['node-delhi-cp', 'node-delhi-india-gate', 'node-delhi-ring-road', 'node-delhi-ito', 'node-delhi-red-fort'],
      coordinates: [
        { lat: 28.6315, lng: 77.2167 },
        { lat: 28.6129, lng: 77.2295 },
        { lat: 28.6050, lng: 77.2100 },
        { lat: 28.6280, lng: 77.2400 },
        { lat: 28.6562, lng: 77.2410 },
      ],
      segments: [
        { edgeId: 'edge-delhi-cp-ig', roadName: 'Janpath Radial Expressway', penaltyMultiplier: 1 },
        { edgeId: 'edge-delhi-ig-ring', roadName: 'Shershah Road Link', penaltyMultiplier: 1 },
        { edgeId: 'edge-delhi-ring-ito', roadName: 'Ring Road Outer Corridor', penaltyMultiplier: 1 },
        { edgeId: 'edge-delhi-ito-redfort', roadName: 'Netaji Subhash Marg', penaltyMultiplier: 1 },
      ],
    },
    {
      routeId: 3,
      name: 'Route 3 via Old Yamuna Bridge (Loha Pul)',
      distanceKm: 4.5,
      estimatedTimeMin: 6.2,
      traffic: 'heavy',
      safety: 'dangerous',
      routeLengthClassification: 'medium',
      color: '#f59e0b',
      pathNodeIds: ['node-delhi-cp', 'node-delhi-ito', 'node-delhi-loha-pul', 'node-delhi-red-fort'],
      coordinates: [
        { lat: 28.6315, lng: 77.2167 },
        { lat: 28.6280, lng: 77.2400 },
        { lat: 28.6200, lng: 77.2350 },
        { lat: 28.6562, lng: 77.2410 },
      ],
      segments: [
        { edgeId: 'edge-delhi-cp-ito', roadName: 'Barakhamba Emergency Arterial', penaltyMultiplier: 1 },
        { edgeId: 'edge-delhi-ito-lohapul', roadName: 'Vikas Marg River Approach', entityId: 'bridge-delhi-01', entityState: 'DAMAGED', penaltyMultiplier: 3.5 },
        { edgeId: 'edge-delhi-lohapul-redfort', roadName: 'Yamuna Bank Bypass', penaltyMultiplier: 1 },
      ],
    },
    {
      routeId: 4,
      name: 'Route 4 via Central Express & Kashmere Gate',
      distanceKm: 4.8,
      estimatedTimeMin: 5.2,
      traffic: 'low',
      safety: 'safe',
      routeLengthClassification: 'medium',
      color: '#3b82f6',
      pathNodeIds: ['node-delhi-cp', 'node-delhi-kashmere-gate', 'node-delhi-red-fort'],
      coordinates: [
        { lat: 28.6315, lng: 77.2167 },
        { lat: 28.6665, lng: 77.2285 },
        { lat: 28.6562, lng: 77.2410 },
      ],
      segments: [
        { edgeId: 'edge-delhi-cp-kg', roadName: 'Central Express Boulevard', penaltyMultiplier: 1 },
        { edgeId: 'edge-delhi-redfort-kg', roadName: 'Old Delhi Northern Highway', penaltyMultiplier: 1 },
      ],
    },
    {
      routeId: 5,
      name: 'Route 5 via AIIMS Trauma Link & Outer Ring Road',
      distanceKm: 7.2,
      estimatedTimeMin: 7.8,
      traffic: 'moderate',
      safety: 'cautious',
      routeLengthClassification: 'long',
      color: '#a855f7',
      pathNodeIds: ['node-delhi-cp', 'node-delhi-ring-road', 'node-delhi-aiims', 'node-delhi-red-fort'],
      coordinates: [
        { lat: 28.6315, lng: 77.2167 },
        { lat: 28.6050, lng: 77.2100 },
        { lat: 28.5672, lng: 77.2100 },
        { lat: 28.6562, lng: 77.2410 },
      ],
      segments: [
        { edgeId: 'edge-delhi-ig-ring', roadName: 'Shershah Road Link', penaltyMultiplier: 1 },
        { edgeId: 'edge-delhi-ring-aiims', roadName: 'South Delhi Medical Corridor', penaltyMultiplier: 1 },
        { edgeId: 'edge-delhi-ito-redfort', roadName: 'Netaji Subhash Marg', penaltyMultiplier: 1 },
      ],
    },
  ];
}

function generateOfflineSector4Routes(): RouteDetail[] {
  return [
    {
      routeId: 1,
      name: 'Route 1 via Southern Sector Ring Road',
      distanceKm: 3.3,
      estimatedTimeMin: 3.8,
      traffic: 'low',
      safety: 'safe',
      routeLengthClassification: 'short',
      color: '#ef4444',
      pathNodeIds: ['node-south-entry', 'node-east-express', 'node-hospital-main', 'node-shelter-alpha'],
      coordinates: [
        { lat: 12.96, lng: 77.59 },
        { lat: 12.962, lng: 77.598 },
        { lat: 12.968, lng: 77.605 },
        { lat: 12.971, lng: 77.6035 },
        { lat: 12.975, lng: 77.602 },
        { lat: 12.977, lng: 77.6 },
        { lat: 12.9785, lng: 77.598 }
      ],
      segments: [
        { edgeId: 'edge-south-east', roadName: 'Southern Sector Ring Road', penaltyMultiplier: 1 },
        { edgeId: 'edge-east-hospital', roadName: 'East Emergency Access', penaltyMultiplier: 1 },
        { edgeId: 'edge-hospital-shelter', roadName: 'Hospital Link Corridor', penaltyMultiplier: 1 }
      ]
    },
    {
      routeId: 2,
      name: 'Route 2 via West Perimeter Bypass',
      distanceKm: 3.4,
      estimatedTimeMin: 4.3,
      traffic: 'low',
      safety: 'safe',
      routeLengthClassification: 'short',
      color: '#10b981',
      pathNodeIds: ['node-south-entry', 'node-west-ring', 'node-north-basin', 'node-shelter-alpha'],
      coordinates: [
        { lat: 12.96, lng: 77.59 },
        { lat: 12.966, lng: 77.587 },
        { lat: 12.972, lng: 77.586 },
        { lat: 12.976, lng: 77.588 },
        { lat: 12.981, lng: 77.591 },
        { lat: 12.98, lng: 77.5945 },
        { lat: 12.9785, lng: 77.598 }
      ],
      segments: [
        { edgeId: 'edge-south-west', roadName: 'West Perimeter Bypass', penaltyMultiplier: 1 },
        { edgeId: 'edge-west-north', roadName: 'Riverbank Causeway', penaltyMultiplier: 1 },
        { edgeId: 'edge-north-shelter', roadName: 'North Shelter Avenue', penaltyMultiplier: 1 }
      ]
    },
    {
      routeId: 3,
      name: 'Route 3 via Bridge B12 Approach',
      distanceKm: 3.1,
      estimatedTimeMin: 4.4,
      traffic: 'moderate',
      safety: 'cautious',
      routeLengthClassification: 'short',
      color: '#f59e0b',
      pathNodeIds: ['node-south-entry', 'node-west-ring', 'node-bridge-b12', 'node-shelter-alpha'],
      coordinates: [
        { lat: 12.96, lng: 77.59 },
        { lat: 12.966, lng: 77.587 },
        { lat: 12.972, lng: 77.586 },
        { lat: 12.9718, lng: 77.59 },
        { lat: 12.9716, lng: 77.5946 },
        { lat: 12.975, lng: 77.596 },
        { lat: 12.9785, lng: 77.598 }
      ],
      segments: [
        { edgeId: 'edge-south-west', roadName: 'West Perimeter Bypass', penaltyMultiplier: 1 },
        { edgeId: 'edge-b12-west', roadName: 'Cross-Town Link', penaltyMultiplier: 1 },
        { edgeId: 'edge-bridge-b12', roadName: 'Bridge B12 Main Span', entityId: 'road-b12', entityState: 'OPEN', penaltyMultiplier: 1.25 }
      ]
    },
    {
      routeId: 4,
      name: 'Route 4 via Outer Perimeter Expressway',
      distanceKm: 4.4,
      estimatedTimeMin: 4.5,
      traffic: 'low',
      safety: 'safe',
      routeLengthClassification: 'long',
      color: '#3b82f6',
      pathNodeIds: ['node-south-entry', 'node-east-express', 'node-northeast-gate', 'node-shelter-alpha'],
      coordinates: [
        { lat: 12.96, lng: 77.59 },
        { lat: 12.962, lng: 77.598 },
        { lat: 12.968, lng: 77.605 },
        { lat: 12.976, lng: 77.606 },
        { lat: 12.983, lng: 77.605 },
        { lat: 12.981, lng: 77.601 },
        { lat: 12.9785, lng: 77.598 }
      ],
      segments: [
        { edgeId: 'edge-south-east', roadName: 'Southern Sector Ring Road', penaltyMultiplier: 1 },
        { edgeId: 'edge-east-northeast', roadName: 'Outer Perimeter Expressway', penaltyMultiplier: 1 },
        { edgeId: 'edge-northeast-shelter', roadName: 'Northeast Access Corridor', penaltyMultiplier: 1 }
      ]
    },
    {
      routeId: 5,
      name: 'Route 5 via Civic Hospital Expressway',
      distanceKm: 3.7,
      estimatedTimeMin: 4.7,
      traffic: 'low',
      safety: 'safe',
      routeLengthClassification: 'medium',
      color: '#a855f7',
      pathNodeIds: ['node-south-entry', 'node-west-ring', 'node-bridge-b12', 'node-hospital-main', 'node-shelter-alpha'],
      coordinates: [
        { lat: 12.96, lng: 77.59 },
        { lat: 12.966, lng: 77.587 },
        { lat: 12.972, lng: 77.586 },
        { lat: 12.9718, lng: 77.59 },
        { lat: 12.9716, lng: 77.5946 },
        { lat: 12.973, lng: 77.598 },
        { lat: 12.975, lng: 77.602 },
        { lat: 12.977, lng: 77.6 },
        { lat: 12.9785, lng: 77.598 }
      ],
      segments: [
        { edgeId: 'edge-south-west', roadName: 'West Perimeter Bypass', penaltyMultiplier: 1 },
        { edgeId: 'edge-b12-west', roadName: 'Cross-Town Link', penaltyMultiplier: 1 },
        { edgeId: 'edge-b12-hospital', roadName: 'Civic Hospital Expressway', penaltyMultiplier: 1 },
        { edgeId: 'edge-hospital-shelter', roadName: 'Hospital Link Corridor', penaltyMultiplier: 1 }
      ]
    }
  ];
}

export default function RouteFinderWindow({
  serverUrl,
  areaId = 'sector-4-demo',
  onRoutesCalculated,
  selectedRouteId,
  onSelectRoute,
  onDispatchTask,
}: RouteFinderWindowProps) {
  const [nodes, setNodes] = useState<RoadNode[]>([]);
  const [sourceId, setSourceId] = useState<string>('');
  const [destId, setDestId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [routeResponse, setRouteResponse] = useState<RouteSearchResponse | null>(null);
  const [committedRoute, setCommittedRoute] = useState<number | null>(null);

  // Execute Route Engine
  const calculateRoutesForNodes = async (src: string, dst: string) => {
    if (!src || !dst) return;
    setCommittedRoute(null);

    // If source and destination are identical, clear routes and return early
    if (src === dst) {
      setLoading(false);
      setRouteResponse(null);
      onRoutesCalculated([], null);
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`${serverUrl}/api/routes?area=${areaId}&from=${src}&to=${dst}`);
      if (!resp.ok) throw new Error('API request failed');
      const data: RouteSearchResponse = await resp.json();
      setRouteResponse(data);
      if (data.routes && data.routes.length > 0) {
        onRoutesCalculated(data.routes, data.routes[0].routeId);
      }
    } catch {
      // Offline fallback calculation for Area
      const isDelhi = areaId === 'delhi-demo';
      const isAssam = areaId === 'assam-demo';
      const offlineRoutes = isDelhi ? generateOfflineDelhiRoutes() : isAssam ? generateOfflineAreaRoutes(ASSAM_FALLBACK_NODES, 'Assam') : generateOfflineSector4Routes();
      const areaNodes = isDelhi ? DELHI_FALLBACK_NODES : isAssam ? ASSAM_FALLBACK_NODES : SECTOR4_FALLBACK_NODES;
      const areaLabel = isDelhi ? 'Delhi NCR' : isAssam ? 'Assam Flood Zone' : 'Sector 4';
      const srcNode = areaNodes.find(n => n.id === src) || areaNodes[0];
      const dstNode = areaNodes.find(n => n.id === dst) || areaNodes[Math.min(3, areaNodes.length - 1)];

      setRouteResponse({
        sourceNode: srcNode,
        destNode: dstNode,
        routes: offlineRoutes,
        aiAnalysis: {
          overview: `Analyzed emergency routes in ${areaLabel} from ${srcNode.name} to ${dstNode.name}.`,
          insights: offlineRoutes.map(r => ({
            routeId: r.routeId,
            summary: `${r.name}: ${r.distanceKm} km • ${r.estimatedTimeMin} min. Traffic: ${r.traffic.toUpperCase()}, Safety: ${r.safety.toUpperCase()}.`,
            advantages: r.traffic === 'low' ? ['Uncongested traffic flow'] : ['Emergency bypass route'],
            disadvantages: r.safety === 'dangerous' ? ['Passes near hazard/damaged zone'] : ['Alternative transit path'],
            potentialConcerns: r.safety === 'dangerous' ? ['Structural hazard reported along path'] : ['No critical hazards detected'],
            preferableWhen: r.routeId === 1 ? `Ideal for time-critical emergency responders in ${areaLabel}.` : `Recommended alternative for ${areaLabel} transit.`,
          })),
          generatedAt: new Date().toISOString(),
        },
        totalRoutesFound: 5,
        calculatedAt: new Date().toISOString(),
      });
      onRoutesCalculated(offlineRoutes, offlineRoutes[0].routeId);
    } finally {
      setLoading(false);
    }
  };

  const calculateRoutes = () => {
    calculateRoutesForNodes(sourceId, destId);
  };

  // Load road nodes from backend when areaId changes
  useEffect(() => {
    const areaNodesFallback = areaId === 'delhi-demo' ? DELHI_FALLBACK_NODES : areaId === 'assam-demo' ? ASSAM_FALLBACK_NODES : SECTOR4_FALLBACK_NODES;

    fetch(`${serverUrl}/api/routes/nodes?area=${areaId}`)
      .then(r => {
        if (!r.ok) throw new Error('API node error');
        return r.json();
      })
      .then(data => {
        if (data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
          setNodes(data.nodes);
          const newSrc = data.nodes[0].id;
          const newDst = data.nodes[Math.min(3, data.nodes.length - 1)].id;
          setSourceId(newSrc);
          setDestId(newDst);
          calculateRoutesForNodes(newSrc, newDst);
        } else {
          throw new Error('Empty nodes');
        }
      })
      .catch(() => {
        setNodes(areaNodesFallback);
        const newSrc = areaNodesFallback[0].id;
        const newDst = areaNodesFallback[Math.min(4, areaNodesFallback.length - 1)].id;
        setSourceId(newSrc);
        setDestId(newDst);
        calculateRoutesForNodes(newSrc, newDst);
      });
  }, [serverUrl, areaId]);

  const activeRoute = routeResponse?.routes.find((r: RouteDetail) => r.routeId === selectedRouteId) ?? routeResponse?.routes[0];
  const activeAIInsight = routeResponse?.aiAnalysis.insights.find((i: AIRouteInsight) => i.routeId === selectedRouteId) ?? routeResponse?.aiAnalysis.insights[0];

  const handleCommitChoice = (r: RouteDetail) => {
    setCommittedRoute(r.routeId);
    if (onDispatchTask) {
      onDispatchTask(`Emergency Route ${r.routeId} Dispatch (${r.distanceKm}km, ${r.estimatedTimeMin}m)`, 'bridge-delhi-01');
    }
  };

  const isSameLocation = sourceId !== '' && sourceId === destId;

  return (
    <div className="rf-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px', gap: '10px', background: '#060e1c', color: '#c8d9f0', overflowY: 'auto' }}>
      
      {/* ── Top Controls: Origin & Destination Picker ── */}
      <div className="rf-picker-card" style={{ background: 'rgba(12, 28, 52, 0.7)', border: '1px solid rgba(0, 229, 255, 0.25)', borderRadius: '6px', padding: '10px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#00e5ff', display: 'block', marginBottom: '3px' }}>
              ORIGIN (POINT A) — {areaId === 'delhi-demo' ? 'DELHI NCR' : areaId === 'assam-demo' ? 'ASSAM FLOOD ZONE' : 'SECTOR 4'}
            </label>
            <select
              value={sourceId}
              onChange={e => setSourceId(e.target.value)}
              style={{ width: '100%', background: '#09182d', border: '1px solid rgba(0, 229, 255, 0.3)', color: '#fff', padding: '5px 8px', borderRadius: '4px', fontSize: '11px' }}
            >
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#00e5ff', display: 'block', marginBottom: '3px' }}>
              DESTINATION (POINT B) — {areaId === 'delhi-demo' ? 'DELHI NCR' : areaId === 'assam-demo' ? 'ASSAM FLOOD ZONE' : 'SECTOR 4'}
            </label>
            <select
              value={destId}
              onChange={e => setDestId(e.target.value)}
              style={{ width: '100%', background: '#09182d', border: '1px solid rgba(0, 229, 255, 0.3)', color: '#fff', padding: '5px 8px', borderRadius: '4px', fontSize: '11px' }}
            >
              {nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={calculateRoutes}
            disabled={loading || isSameLocation}
            style={{
              marginTop: '15px',
              background: isSameLocation ? 'rgba(148, 163, 184, 0.2)' : 'linear-gradient(135deg, #00e5ff, #0284c7)',
              border: 'none',
              color: isSameLocation ? '#94a3b8' : '#000',
              fontWeight: 800,
              padding: '6px 14px',
              borderRadius: '4px',
              cursor: isSameLocation ? 'not-allowed' : loading ? 'wait' : 'pointer',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {loading ? '⚡ CALCULATING...' : '🧭 FIND 5 ROUTES'}
          </button>
        </div>
      </div>

      {/* ── Identical Location Handling ── */}
      {isSameLocation ? (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '6px',
          padding: '24px 16px',
          color: '#fca5a5',
          textAlign: 'center',
          margin: '8px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{ fontSize: '28px' }}>📍</div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#ff6b6b', letterSpacing: '0.5px' }}>
            STARTING AND ENDING LOCATIONS ARE IDENTICAL
          </div>
          <div style={{ fontSize: '11px', color: '#cbd5e1', maxWidth: '440px', lineHeight: '1.5' }}>
            Origin (Point A) and Destination (Point B) are both set to <b>"{nodes.find(n => n.id === sourceId)?.name || 'the same location'}"</b>.
            <br /><br />
            No route calculation is required because the unit is already at the destination location. Select a different location to generate emergency routes.
          </div>
        </div>
      ) : (
        <>
          {/* ── Status Banner ── */}
          <div style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '4px', padding: '6px 10px', color: '#6ee7b7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🤖 <b>AI DECISION SUPPORT ({areaId === 'delhi-demo' ? 'DELHI NCR' : areaId === 'assam-demo' ? 'ASSAM FLOOD ZONE' : 'SECTOR 4'})</b> — 5 analyzed routes. System will NOT auto-select. Operator choice required.</span>
            {routeResponse && <span>{routeResponse.totalRoutesFound} Routes Found</span>}
          </div>

          {/* ── 5 Route Cards Grid ── */}
          <div className="rf-routes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
            {routeResponse?.routes.map((r: RouteDetail) => {
              const isSelected = selectedRouteId === r.routeId;
              const isCommitted = committedRoute === r.routeId;

              return (
                <div
                  key={r.routeId}
                  onClick={() => onSelectRoute(r.routeId)}
                  style={{
                    background: isSelected ? 'rgba(0, 229, 255, 0.12)' : 'rgba(9, 24, 45, 0.7)',
                    border: `2px solid ${isSelected ? r.color : 'rgba(0, 229, 255, 0.15)'}`,
                    borderRadius: '6px',
                    padding: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? `0 0 12px ${r.color}44` : 'none',
                    position: 'relative',
                  }}
                >
                  {/* Color Header Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: r.color }}>
                      ROUTE {r.routeId}
                    </span>
                    <span style={{ fontSize: '9px', background: `${r.color}22`, color: r.color, border: `1px solid ${r.color}55`, padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                      {r.routeLengthClassification.toUpperCase()}
                    </span>
                  </div>

                  {/* Time & Distance */}
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                    {Number(r.estimatedTimeMin).toFixed(1)} min <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>• {r.distanceKm} km</span>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '3px', fontWeight: 700, background: r.traffic === 'heavy' ? '#ef444433' : r.traffic === 'moderate' ? '#f59e0b33' : '#10b98133', color: r.traffic === 'heavy' ? '#fca5a5' : r.traffic === 'moderate' ? '#fcd34d' : '#6ee7b7' }}>
                      Traffic: {r.traffic}
                    </span>
                    <span style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '3px', fontWeight: 700, background: r.safety === 'dangerous' ? '#ef444433' : r.safety === 'cautious' ? '#f59e0b33' : '#10b98133', color: r.safety === 'dangerous' ? '#fca5a5' : r.safety === 'cautious' ? '#fcd34d' : '#6ee7b7' }}>
                      Safety: {r.safety}
                    </span>
                  </div>

                  {isCommitted && (
                    <div style={{ position: 'absolute', top: '4px', right: '4px', background: '#10b981', color: '#000', fontSize: '8px', fontWeight: 900, padding: '2px 4px', borderRadius: '2px' }}>
                      ✓ DISPATCHED
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Selected Route AI Analysis Panel ── */}
          {activeRoute && activeAIInsight && (
            <div style={{ background: 'rgba(9, 24, 45, 0.85)', border: `1px solid ${activeRoute.color}55`, borderRadius: '6px', padding: '10px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: activeRoute.color }}>
                  🤖 AI ANALYSIS — ROUTE {activeRoute.routeId} ({activeRoute.name})
                </span>
                <button
                  onClick={() => handleCommitChoice(activeRoute)}
                  style={{
                    background: committedRoute === activeRoute.routeId ? '#10b981' : activeRoute.color,
                    color: '#000',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '3px',
                    fontWeight: 800,
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  {committedRoute === activeRoute.routeId ? '✓ ROUTE COMMITTED' : `CHOOSE ROUTE ${activeRoute.routeId} & DISPATCH`}
                </button>
              </div>

              <div style={{ fontSize: '11px', color: '#e2e8f0', marginBottom: '8px', lineHeight: '1.4' }}>
                {activeAIInsight.summary}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10px' }}>
                {/* Advantages */}
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '6px', borderRadius: '4px' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>ADVANTAGES</span>
                  <ul style={{ margin: '4px 0 0 12px', padding: 0, color: '#a7f3d0' }}>
                    {activeAIInsight.advantages.map((adv: string, idx: number) => (
                      <li key={idx}>{adv}</li>
                    ))}
                  </ul>
                </div>

                {/* Disadvantages */}
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px', borderRadius: '4px' }}>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>DISADVANTAGES</span>
                  <ul style={{ margin: '4px 0 0 12px', padding: 0, color: '#fca5a5' }}>
                    {activeAIInsight.disadvantages.map((dis: string, idx: number) => (
                      <li key={idx}>{dis}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Contextual Recommendation */}
              <div style={{ marginTop: '8px', background: 'rgba(0, 229, 255, 0.08)', border: '1px solid rgba(0, 229, 255, 0.2)', padding: '6px', borderRadius: '4px', fontSize: '10px' }}>
                <span style={{ color: '#00e5ff', fontWeight: 700 }}>TACTICAL RECOMMENDATION: </span>
                <span style={{ color: '#cbd5e1' }}>{activeAIInsight.preferableWhen}</span>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Entity, Conflict } from '../App';

// Fix Leaflet marker icon asset URLs in bundler environments
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapProps {
  entities: Entity[];
  conflicts: Conflict[];
  targetLocation: { lat: number; lng: number; zoom: number; name: string } | null;
  onSelectEntity: (e: Entity) => void;
}

// Controller component to smoothly animate map center to pinpointed locations
function MapFlyTo({ targetLocation }: { targetLocation: MapProps['targetLocation'] }) {
  const map = useMap();
  useEffect(() => {
    if (targetLocation) {
      map.flyTo([targetLocation.lat, targetLocation.lng], targetLocation.zoom, {
        animate: true,
        duration: 1.5
      });
    }
  }, [targetLocation, map]);
  return null;
}

export default function LeafletMapWorkspace({ entities, conflicts, targetLocation, onSelectEntity }: MapProps) {
  const centerLat = targetLocation?.lat || 12.9716;
  const centerLng = targetLocation?.lng || 77.5946;

  // Polygon boundary representing Sector 4 operational zone
  const sector4Polygon: [number, number][] = [
    [12.9800, 77.5850],
    [12.9820, 77.6050],
    [12.9620, 77.6080],
    [12.9600, 77.5880],
  ];

  return (
    <div className="map-workspace-container">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> Dark Matter'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapFlyTo targetLocation={targetLocation} />

        {/* Sector 4 Operational Area Highlight Boundary */}
        <Polygon
          positions={sector4Polygon}
          pathOptions={{ color: '#38bdf8', weight: 2, dashArray: '5, 5', fillOpacity: 0.05 }}
        />

        {/* Render Uncertainty Zones as visual Pulsing Overlay Circles */}
        {entities.map((e) => {
          if (e.is_stale) {
            return (
              <Circle
                key={`unc-stale-${e.id}`}
                center={[e.location.lat, e.location.lng]}
                radius={600}
                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.18, weight: 2 }}
              />
            );
          }
          if (e.has_conflict) {
            return (
              <Circle
                key={`unc-conflict-${e.id}`}
                center={[e.location.lat, e.location.lng]}
                radius={800}
                pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25, weight: 3 }}
              />
            );
          }
          return null;
        })}

        {/* Render Operational Entity Markers */}
        {entities.map((e) => (
          <Marker
            key={e.id}
            position={[e.location.lat, e.location.lng]}
            eventHandlers={{
              click: () => onSelectEntity(e),
            }}
          >
            <Popup className="map-popup">
              <div className="popup-content">
                <h3>{e.name}</h3>
                <p>State: <strong>{e.current_state}</strong></p>
                <p>Confidence: {(e.confidence * 100).toFixed(0)}%</p>
                <p>Observed: {new Date(e.last_observed_at).toLocaleTimeString()}</p>
                {e.is_stale && <span className="popup-tag tag-stale">⚠️ STALE</span>}
                {e.has_conflict && <span className="popup-tag tag-conflict">🚨 CONFLICT</span>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

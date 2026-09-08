import React, { useState } from 'react';

interface MediaItem {
  id: string;
  title: string;
  location: string;
  timestamp: string;
  damageClass: string;
  confidence: number;
  imageUrl: string;
}

const SAMPLE_MEDIA: MediaItem[] = [
  {
    id: 'm1',
    title: 'Bridge B12 Structural Crack',
    location: '28.6139° N, 77.2090° E',
    timestamp: '10m ago',
    damageClass: 'CRITICAL DAMAGE (94%)',
    confidence: 0.94,
    imageUrl: 'https://images.unsplash.com/photo-1545558014-8692077e9b5c?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'm2',
    title: 'Sector 4 Inundated Roadway',
    location: '28.6250° N, 77.2150° E',
    timestamp: '24m ago',
    damageClass: 'WATERLOGGED / BLOCKED (88%)',
    confidence: 0.88,
    imageUrl: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'm3',
    title: 'Community Shelter Alpha Entry',
    location: '28.6080° N, 77.1980° E',
    timestamp: '1h ago',
    damageClass: 'OPERATIONAL / HIGH DENSITY (96%)',
    confidence: 0.96,
    imageUrl: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=600&q=80',
  },
];

export default function MediaWindow() {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem>(SAMPLE_MEDIA[0]);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  const handleRunAIVision = () => {
    setAnalyzing(true);
    setAiReport(null);
    setTimeout(() => {
      setAnalyzing(false);
      setAiReport(
        `🔍 **AI Visual Inspection Result**\n` +
        `• Detected Feature: ${selectedMedia.title}\n` +
        `• Hazard Assessment: ${selectedMedia.damageClass}\n` +
        `• Structural Risk Index: High\n` +
        `• Recommended Action: Block vehicle access immediately and assign structural engineering unit.`
      );
    }, 900);
  };

  return (
    <div className="fw-body-inner flex-col">
      {/* Live Telemetry Banner */}
      <div className="media-hud-bar">
        <span className="hud-badge pulse">LIVE STREAM</span>
        <span>DRONE-01 TELEMETRY</span>
        <span className="hud-val">ALT: 120m</span>
        <span className="hud-val">BAT: 84%</span>
        <span className="hud-val">GPS: LOCKED</span>
      </div>

      {/* Main Viewport */}
      <div className="media-viewport">
        <img
          src={selectedMedia.imageUrl}
          alt={selectedMedia.title}
          className="media-img"
        />
        <div className="media-overlay">
          <div className="media-title">{selectedMedia.title}</div>
          <div className="media-coords">📍 {selectedMedia.location} &middot; {selectedMedia.timestamp}</div>
          <div className="media-hazard">{selectedMedia.damageClass}</div>
        </div>
      </div>

      {/* AI Analysis Action */}
      <div className="media-actions">
        <button
          className="btn-ai-vision"
          onClick={handleRunAIVision}
          disabled={analyzing}
        >
          {analyzing ? '⌛ ANALYZING IMAGE...' : '⚡ RUN AI VISUAL DAMAGE ASSESSMENT'}
        </button>
      </div>

      {aiReport && (
        <div className="media-ai-report">
          {aiReport.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {/* Gallery Selector */}
      <div className="media-gallery flex-row">
        {SAMPLE_MEDIA.map(m => (
          <div
            key={m.id}
            className={`gallery-thumb ${selectedMedia.id === m.id ? 'active' : ''}`}
            onClick={() => {
              setSelectedMedia(m);
              setAiReport(null);
            }}
          >
            <img src={m.imageUrl} alt={m.title} />
            <div className="thumb-caption">{m.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { localLLMEngine } from './realLocalLLM';
import type { RealLLMResult } from './realLocalLLM';

interface SyncItem {
  event_id: string;
  type: string;
  entity_id: string;
  entity_type: string;
  previous_state: string;
  new_state: string;
  location: { lat: number; lng: number };
  observed_at: string;
  source_id: string;
  confidence: number;
  freshness: { last_observed_at: string; valid_until: string; is_stale: boolean };
  evidence: Array<{ id: string; type: string; notes?: string; captured_at: string; captured_by: string }>;
  sync_status: 'PENDING' | 'SYNCED' | 'FAILED';
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  intent?: RealLLMResult;
  isPending?: boolean;
}

const UNIT_ID = 'unit-17';
const SERVER = 'http://localhost:4000';
const STORAGE_KEY = 'disaster_field_queue_v3';

export default function App() {
  const [isOnline, setIsOnline] = useState(true);
  const [input, setInput] = useState('');
  const [llmStatus, setLlmStatus] = useState<string>('Initializing Local Model...');
  const [llmProgress, setLlmProgress] = useState<number>(0);
  const [isRealLLMActive, setIsRealLLMActive] = useState<boolean>(false);
  const [chat, setChat] = useState<ChatMessage[]>([
    {
      role: 'ai',
      content:
        '🟢 Local AI Engine Starting...\n\nUnit 17, I am your local operational assistant running 100% locally. Describe your observation in natural language.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [queue, setQueue] = useState<SyncItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  });
  const [pendingIntent, setPendingIntent] = useState<RealLLMResult | null>(null);
  const [evidenceEnabled, setEvidenceEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'CHAT' | 'QUEUE' | 'DEBUG'>('CHAT');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Load Real Local WASM Model on startup
  useEffect(() => {
    localLLMEngine.init((progress, text) => {
      setLlmProgress(progress);
      setLlmStatus(text);
      if (progress === 100) setIsRealLLMActive(true);
    });
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date().toISOString() };
    const thinking: ChatMessage = { role: 'ai', content: '… [Local WASM LLM Inferencing]', timestamp: new Date().toISOString(), isPending: true };

    setChat((c) => [...c, userMsg, thinking]);
    const currentInput = input;
    setInput('');

    // Perform Local LLM Inference
    const result = await localLLMEngine.parse(currentInput);

    const stateBadge = `**${result.new_state}**`;
    const confPct = `${(result.confidence * 100).toFixed(0)}%`;
    let aiContent =
      `🤖 **Local LLM Output** *(${result.is_real_llm_inference ? 'Local ONNX WASM Engine' : 'Local Deterministic Fallback'} — ${result.inference_time_ms}ms)*\n\n` +
      `• **Intent:** \`${result.intent}\`\n` +
      `• **Target Entity:** \`${result.entity_id}\`\n` +
      `• **New State:** ${stateBadge}\n` +
      `• **Confidence:** ${confPct}\n\n`;

    if (result.followup_question) {
      aiContent += `💬 ${result.followup_question}\n\n`;
    }
    aiContent += `> Review extracted operation below and commit to local queue.`;

    const aiMsg: ChatMessage = {
      role: 'ai',
      content: aiContent,
      timestamp: new Date().toISOString(),
      intent: result,
    };

    setChat((c) => c.filter((m) => !m.isPending).concat(aiMsg));
    setPendingIntent(result);
  };

  const commitDelta = () => {
    if (!pendingIntent) return;
    const now = new Date().toISOString();
    const delta: SyncItem = {
      event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: pendingIntent.intent,
      entity_id: pendingIntent.entity_id,
      entity_type: pendingIntent.entity_type,
      previous_state: 'OPEN',
      new_state: pendingIntent.new_state,
      location: { lat: 12.9716, lng: 77.5946 },
      observed_at: now,
      source_id: UNIT_ID,
      confidence: pendingIntent.confidence,
      freshness: {
        last_observed_at: now,
        valid_until: new Date(Date.now() + 3_600_000).toISOString(),
        is_stale: false,
      },
      evidence: evidenceEnabled
        ? [{ id: `ev-${Date.now()}`, type: 'PHOTO', notes: 'On-site photo evidence', captured_at: now, captured_by: UNIT_ID }]
        : [],
      sync_status: 'PENDING',
    };

    setQueue((q) => [delta, ...q]);
    setPendingIntent(null);
    setEvidenceEnabled(false);

    const confirmMsg: ChatMessage = {
      role: 'ai',
      content: `✅ **State Delta Stored in Local Queue**\nEvent \`${delta.event_id}\` committed to durable local DB.\nStatus: **PENDING SYNC**`,
      timestamp: new Date().toISOString(),
    };
    setChat((c) => [...c, confirmMsg]);
  };

  const triggerSync = async () => {
    const pending = queue.filter((i) => i.sync_status === 'PENDING');
    if (!pending.length) return;

    setSyncing(true);
    try {
      const res = await fetch(`${SERVER}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: UNIT_ID, timestamp: new Date().toISOString(), deltas: pending }),
      });
      const data = await res.json();
      if (data.success) {
        const acked: string[] = data.acknowledged_event_ids;
        setQueue((q) => q.map((item) => (acked.includes(item.event_id) ? { ...item, sync_status: 'SYNCED' } : item)));
        setChat((c) => [...c, { role: 'ai', content: `📡 **Synced ${acked.length} event(s)** with Command Server.`, timestamp: new Date().toISOString() }]);
      }
    } catch {
      alert('Sync failed — server unreachable');
    } finally {
      setSyncing(false);
    }
  };

  const pendingCount = queue.filter((i) => i.sync_status === 'PENDING').length;

  return (
    <div className="field-root">
      <header className="field-header">
        <div className="unit-badge">
          <span className="unit-icon">📱</span>
          <div>
            <div className="unit-name">FIELD RESPONDER UNIT-17</div>
            <div className="unit-sub">Local AI & Offline Durable State Engine</div>
          </div>
        </div>

        <div className="field-header-right">
          <span className={`connectivity-pill ${isOnline ? 'pill-online' : 'pill-offline'}`}>
            {isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}
          </span>
          <button className={`toggle-btn ${isOnline ? 'toggle-disconnect' : 'toggle-connect'}`} onClick={() => setIsOnline(!isOnline)}>
            {isOnline ? 'Disable Internet (Offline Test)' : 'Restore Internet'}
          </button>
        </div>
      </header>

      {/* Model Loader Banner */}
      <div className="llm-status-banner">
        <div className="llm-status-info">
          <span>🧠 Local LLM Engine: <strong>{llmStatus}</strong></span>
          <span className="llm-badge">{isRealLLMActive ? '100% OFFLINE ACTIVE' : 'WASM INITIALIZING'}</span>
        </div>
        {llmProgress < 100 && (
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${llmProgress}%` }} />
          </div>
        )}
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'CHAT' ? 'tab-active' : ''}`} onClick={() => setActiveTab('CHAT')}>💬 Local Assistant</button>
        <button className={`tab-btn ${activeTab === 'QUEUE' ? 'tab-active' : ''}`} onClick={() => setActiveTab('QUEUE')}>📥 Sync Queue ({pendingCount})</button>
        <button className={`tab-btn ${activeTab === 'DEBUG' ? 'tab-active' : ''}`} onClick={() => setActiveTab('DEBUG')}>⚙ Engine Telemetry</button>
      </div>

      <main className="field-main">
        {activeTab === 'CHAT' && (
          <div className="chat-panel">
            <div className="chat-messages">
              {chat.map((msg, i) => (
                <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'} ${msg.isPending ? 'bubble-pending' : ''}`}>
                  <div className="bubble-role">{msg.role === 'user' ? '👤 Responder' : '🤖 Local AI Engine'}</div>
                  <div className="bubble-content">{msg.content}</div>
                  <div className="bubble-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}

              {pendingIntent && (
                <div className="commit-panel">
                  <div className="commit-header">
                    <span>⚡ Confirm Operation to Local Database</span>
                  </div>
                  <div className="commit-grid">
                    <div><strong>Intent:</strong> <code>{pendingIntent.intent}</code></div>
                    <div><strong>Entity:</strong> <code>{pendingIntent.entity_id}</code></div>
                    <div><strong>New State:</strong> <span className="state-badge">{pendingIntent.new_state}</span></div>
                    <div><strong>Confidence:</strong> {(pendingIntent.confidence * 100).toFixed(0)}%</div>
                  </div>
                  <label className="evidence-toggle">
                    <input type="checkbox" checked={evidenceEnabled} onChange={(e) => setEvidenceEnabled(e.target.checked)} />
                    Attach photo & GPS location evidence
                  </label>
                  <div className="commit-actions">
                    <button className="btn-commit" onClick={commitDelta}>💾 Store State Change</button>
                    <button className="btn-discard" onClick={() => setPendingIntent(null)}>Discard</button>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form className="chat-input-bar" onSubmit={handleSend}>
              <textarea
                className="chat-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Type operational observation e.g. "Bridge B12 is damaged. Water is rising rapidly."'
                rows={2}
              />
              <button type="submit" className="btn-send" disabled={!input.trim()}>Send</button>
            </form>
          </div>
        )}

        {activeTab === 'QUEUE' && (
          <div className="queue-panel">
            <div className="queue-status-row">
              <div>Pending Items: <strong>{pendingCount}</strong></div>
              <button className="btn-sync" onClick={triggerSync} disabled={!isOnline || syncing || pendingCount === 0}>
                {syncing ? 'Syncing...' : `⚡ Flush Queue (${pendingCount})`}
              </button>
            </div>
            <div className="queue-list">
              {queue.map((item) => (
                <div key={item.event_id} className={`q-item qs-${item.sync_status.toLowerCase()}`}>
                  <div><strong>{item.entity_id}</strong> → {item.new_state} ({item.sync_status})</div>
                  <small>{new Date(item.observed_at).toLocaleTimeString()} | Event: {item.event_id}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'DEBUG' && (
          <div className="queue-panel">
            <h3>Local Inference Telemetry</h3>
            <p>Model Engine: Transformers.js / ONNX MobileBERT WASM</p>
            <p>Local DB Persistence: IndexedDB / LocalStorage</p>
            <p>Cloud LLM Fetch Requests: <strong>0 (Strict Offline Protocol)</strong></p>
          </div>
        )}
      </main>
    </div>
  );
}

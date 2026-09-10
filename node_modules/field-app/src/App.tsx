import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { localLLMEngine } from './realLocalLLM';
import type { RealLLMResult } from './realLocalLLM';
import {
  ArrowRight, ArrowUp, FileText, HandHelping, HelpCircle, House, LifeBuoy, Map,
  MapPinned, MessageCircle, Mic, Package, Paperclip, Plus, Radio, Route, Settings,
  ShieldCheck, Siren, TriangleAlert, Wifi, WifiOff, X,
} from 'lucide-react';
import { VoiceWaveformInput } from './VoiceWaveformInput';

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
  evidence: Array<{ id: string; type: string; data_base64?: string; notes?: string; captured_at: string; captured_by: string }>;
  sync_status: 'PENDING' | 'SYNCED' | 'FAILED';
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  intent?: RealLLMResult;
  isPending?: boolean;
  audioUrl?: string;
}

const UNIT_ID = 'unit-17';
const SERVER = 'http://localhost:4000';
const STORAGE_KEY = 'disaster_field_queue_v3';

interface AppProps {
  onVoiceInput?: () => void;
}

export default function App({ onVoiceInput }: AppProps = {}) {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [pendingEvidenceFiles, setPendingEvidenceFiles] = useState<File[]>([]);
  const [isVoiceMode, setIsVoiceMode] = useState<boolean>(false);
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
  const [activeTab, setActiveTab] = useState<'HOME' | 'CHAT' | 'QUEUE' | 'DEBUG'>('HOME');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }
    if (e.target) e.target.value = '';
  };

  const removeFile = (indexToRemove: number) => {
    setAttachedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleVoiceInput = () => {
    setIsVoiceMode(true);
    if (onVoiceInput) {
      onVoiceInput();
    }
  };

  const handleVoiceConfirm = async (data: any) => {
    setIsVoiceMode(false);
    const voiceText = data.text || 'Voice note recorded.';
    const durationStr = data.durationSeconds ? ` (${data.durationSeconds}s)` : '';

    const userMsg: ChatMessage = {
      role: 'user',
      content: `🎙 Voice Recording${durationStr}: "${voiceText}"`,
      timestamp: new Date().toISOString(),
      audioUrl: data.audioUrl,
    };
    const thinking: ChatMessage = { role: 'ai', content: '… [Local WASM LLM Inferencing]', timestamp: new Date().toISOString(), isPending: true };

    setChat((c) => [...c, userMsg, thinking]);

    // Perform Local LLM Inference
    const result = await localLLMEngine.parse(voiceText);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || attachedFiles.length > 0) {
        const form = e.currentTarget.closest('form');
        if (form) form.requestSubmit();
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && attachedFiles.length === 0) return;

    let messageContent = input.trim();
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map((f) => `📎 ${f.name}`).join(', ');
      messageContent = messageContent ? `${messageContent}\n[Attachments: ${fileNames}]` : `[Attachments: ${fileNames}]`;
    }

    const userMsg: ChatMessage = { role: 'user', content: messageContent, timestamp: new Date().toISOString() };
    const thinking: ChatMessage = { role: 'ai', content: '… [Local WASM LLM Inferencing]', timestamp: new Date().toISOString(), isPending: true };

    setChat((c) => [...c, userMsg, thinking]);
    const currentInput = messageContent;
    setInput('');
    setPendingEvidenceFiles(attachedFiles);
    setAttachedFiles([]);

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

  const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ lat: 12.9716, lng: 77.5946 });
    navigator.geolocation.getCurrentPosition(
      position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve({ lat: 12.9716, lng: 77.5946 }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 15000 },
    );
  });

  const commitDelta = async () => {
    if (!pendingIntent) return;
    const now = new Date().toISOString();
    const location = await getCurrentLocation();
    const fileEvidence = evidenceEnabled
      ? await Promise.all(pendingEvidenceFiles.map(async file => ({
        id: `ev-${Date.now()}-${file.name}`,
        type: 'PHOTO',
        data_base64: await readFileAsDataUrl(file),
        notes: file.name,
        captured_at: now,
        captured_by: UNIT_ID,
      })))
      : [];
    const delta: SyncItem = {
      event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: pendingIntent.intent,
      entity_id: pendingIntent.entity_id,
      entity_type: pendingIntent.entity_type,
      previous_state: 'OPEN',
      new_state: pendingIntent.new_state,
      location,
      observed_at: now,
      source_id: UNIT_ID,
      confidence: pendingIntent.confidence,
      freshness: {
        last_observed_at: now,
        valid_until: new Date(Date.now() + 3_600_000).toISOString(),
        is_stale: false,
      },
      evidence: evidenceEnabled
        ? [...fileEvidence, { id: `gps-${Date.now()}`, type: 'GPS', notes: 'Device location at observation time', captured_at: now, captured_by: UNIT_ID }]
        : [],
      sync_status: 'PENDING',
    };

    setQueue((q) => [delta, ...q]);
    setPendingIntent(null);
    setEvidenceEnabled(false);
    setPendingEvidenceFiles([]);

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

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void triggerSync();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queue]);

  const pendingCount = queue.filter((i) => i.sync_status === 'PENDING').length;

  const openWorkflow = (prompt: string) => {
    setActiveTab('CHAT');
    setInput(prompt);
  };

  const navigateTo = (destination: 'HOME' | 'CHAT' | 'QUEUE' | 'DEBUG') => {
    setActiveTab(destination);
  };

  return (
    <div className="field-root">
      <header className="field-header">
        <div className="unit-badge">
          <span className="unit-icon"><ShieldCheck size={24} /></span>
          <div>
            <div className="unit-name">FIELD RESPONDER UNIT-17</div>
            <div className="unit-sub">Disaster Response &amp; Field Operations</div>
          </div>
        </div>

        <div className="field-header-right">
          <span className="location-pill"><MapPinned size={14} /> Sector 4 South Access Point</span>
          <span className={`connectivity-pill ${isOnline ? 'pill-online' : 'pill-offline'}`}>
            {isOnline ? <><Wifi size={13} /> ON DUTY / ACTIVE OPERATIONS</> : <><WifiOff size={13} /> OFFLINE MODE</>}
          </span>
          <div className="operations-card"><Radio size={17} /><div><strong>ON DUTY</strong><span>UNIT-17 Field Operations</span></div><button className="connection-toggle" onClick={() => setIsOnline(!isOnline)} title={isOnline ? 'Disable internet for offline test' : 'Restore internet'} aria-label={isOnline ? 'Disable internet for offline test' : 'Restore internet'}>{isOnline ? <WifiOff size={14} /> : <Wifi size={14} />}</button></div>
        </div>
      </header>

      <div className="field-layout">
        <aside className="side-nav" aria-label="Primary navigation">
          <div className="nav-label">FIELD CONSOLE</div>
          <button className={`side-nav-item side-nav-sos ${activeTab === 'HOME' ? 'nav-active' : ''}`} onClick={() => navigateTo('HOME')}><Siren size={19} /><span>SOS</span></button>
          <button className="side-nav-item" onClick={() => openWorkflow('Navigate safely: find a safe route and identify nearby risk areas.') }><Map size={19} /><span>Map</span></button>
          <button className={`side-nav-item ${activeTab === 'CHAT' ? 'nav-active' : ''}`} onClick={() => navigateTo('CHAT')}><MessageCircle size={19} /><span>Chat</span></button>
          <button className={`side-nav-item ${activeTab === 'QUEUE' ? 'nav-active' : ''}`} onClick={() => navigateTo('QUEUE')}><FileText size={19} /><span>Reports</span>{pendingCount > 0 && <b>{pendingCount}</b>}</button>
          <button className={`side-nav-item ${activeTab === 'DEBUG' ? 'nav-active' : ''}`} onClick={() => navigateTo('DEBUG')}><HelpCircle size={19} /><span>Help</span></button>
          <div className="sidebar-footer"><div className="sidebar-status-dot" /><span>{isOnline ? 'Connected' : 'Offline ready'}</span></div>
        </aside>

        <section className="field-workspace">
          <div className="workspace-topline">
            <div><span className="eyebrow">OPERATIONAL OVERVIEW</span><h1>{activeTab === 'HOME' ? 'Field response dashboard' : activeTab === 'CHAT' ? 'Local AI Assistant' : activeTab === 'QUEUE' ? 'Reports & sync queue' : 'Help & system status'}</h1></div>
            <div className="engine-indicator"><span className="engine-dot" /> Local AI {isRealLLMActive ? 'active' : 'initializing'}</div>
          </div>

          {activeTab === 'HOME' && (
            <div className="home-dashboard">
              <section className="hero-card">
                <div className="hero-copy"><span className="duty-badge"><span /> UNIT-17 | ON DUTY</span><h2>Need Help?</h2><p>Your safety is our priority. Report an emergency or request operational support from your field command center.</p><button className="hero-link" onClick={() => openWorkflow('I need immediate assistance. Please assess this distress situation.')}>Open assistant <ArrowRight size={16} /></button></div>
                <div className="hero-art" aria-hidden="true"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><ShieldCheck size={106} strokeWidth={1.2} /></div>
              </section>

              <button className="sos-card" onClick={() => openWorkflow('SOS DISTRESS SIGNAL: I need immediate emergency assistance. Assess and escalate this situation.') }>
                <span className="sos-icon"><Siren size={31} /></span><span className="sos-copy"><strong>SEND SOS DISTRESS SIGNAL</strong><small>Immediate help for life-threatening situations</small></span><span className="circle-arrow"><ArrowRight size={21} /></span>
              </button>

              <div className="action-grid">
                <button className="action-card action-supplies" onClick={() => openWorkflow('Request supplies: I need food, water, medical or other essential supplies.') }><span className="action-icon"><Package size={24} /></span><span className="action-content"><strong>Request Supplies</strong><small>Food, water, medical &amp; other essential supplies</small></span><span className="small-arrow"><ArrowRight size={17} /></span></button>
                <button className="action-card action-report" onClick={() => openWorkflow('Report situation: describe the fire, damage, hazard or incident I observed.') }><span className="action-icon"><TriangleAlert size={24} /></span><span className="action-content"><strong>Report Situation</strong><small>Fire, damage, hazard or other incidents</small></span><span className="small-arrow"><ArrowRight size={17} /></span></button>
                <button className="action-card action-help" onClick={() => openWorkflow('Request help: I need medical, rescue, transport or additional support.') }><span className="action-icon"><HandHelping size={24} /></span><span className="action-content"><strong>Request Help</strong><small>Medical, rescue, transport or additional support</small></span><span className="small-arrow"><ArrowRight size={17} /></span></button>
                <button className="action-card action-route" onClick={() => openWorkflow('Navigate safely: find a safe route and identify nearby risk areas.') }><span className="action-icon"><Route size={24} /></span><span className="action-content"><strong>Navigate Safely</strong><small>Get safe routes and avoid risk areas</small></span><span className="small-arrow"><ArrowRight size={17} /></span></button>
              </div>

              <div className="home-footer-strip"><div><span className="strip-label">SYSTEM STATUS</span><strong>{isOnline ? 'All field systems operational' : 'Offline mode enabled'}</strong></div><div><span className="strip-label">PENDING REPORTS</span><strong>{pendingCount} awaiting sync</strong></div><button onClick={() => navigateTo('QUEUE')}>View reports <ArrowRight size={15} /></button></div>
            </div>
          )}

          {activeTab !== 'HOME' && (
            <div className="operational-panel">
              <div className="llm-status-banner"><div className="llm-status-info"><span><Settings size={15} /> Local LLM Engine: <strong>{llmStatus}</strong></span><span className="llm-badge">{isRealLLMActive ? '100% OFFLINE ACTIVE' : 'WASM INITIALIZING'}</span></div>{llmProgress < 100 && <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${llmProgress}%` }} /></div>}</div>
              <div className="tab-bar"><button className={`tab-btn ${activeTab === 'CHAT' ? 'tab-active' : ''}`} onClick={() => setActiveTab('CHAT')}>💬 Local Assistant</button><button className={`tab-btn ${activeTab === 'QUEUE' ? 'tab-active' : ''}`} onClick={() => setActiveTab('QUEUE')}>📥 Sync Queue ({pendingCount})</button><button className={`tab-btn ${activeTab === 'DEBUG' ? 'tab-active' : ''}`} onClick={() => setActiveTab('DEBUG')}>⚙ Engine Telemetry</button></div>

      <main className="field-main">
        {activeTab === 'CHAT' && (
          <div className="chat-panel">
            <div className="chat-messages">
              {chat.map((msg, i) => (
                <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'} ${msg.isPending ? 'bubble-pending' : ''}`}>
                  <div className="bubble-role">{msg.role === 'user' ? '👤 Responder' : '🤖 Local AI Engine'}</div>
                  <div className="bubble-content">{msg.content}</div>
                  {msg.audioUrl && (
                    <div className="bubble-audio-player">
                      <audio src={msg.audioUrl} controls />
                    </div>
                  )}
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

            {isVoiceMode ? (
              <div className="chat-input-bar">
                <VoiceWaveformInput
                  onConfirm={handleVoiceConfirm}
                  onCancel={() => setIsVoiceMode(false)}
                />
              </div>
            ) : (
              <form className="chat-input-bar" onSubmit={handleSend}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  multiple
                  tabIndex={-1}
                  aria-hidden="true"
                />

                {attachedFiles.length > 0 && (
                  <div className="attached-files-row">
                    {attachedFiles.map((file, idx) => (
                      <div key={idx} className="file-chip">
                        <Paperclip size={13} className="file-chip-icon" />
                        <span className="file-chip-name">{file.name}</span>
                        <button
                          type="button"
                          className="file-chip-remove"
                          onClick={() => removeFile(idx)}
                          aria-label={`Remove file ${file.name}`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="chat-input-container">
                  <button
                    type="button"
                    className="chat-action-btn btn-attach"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach files"
                    aria-label="Attach files"
                  >
                    <Plus size={19} />
                  </button>

                  <textarea
                    className="chat-textarea"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Type operational observation e.g. "Bridge B12 is damaged. Water is rising rapidly."'
                    rows={1}
                  />

                  <button
                    type="button"
                    className="chat-action-btn btn-mic"
                    onClick={handleVoiceInput}
                    title="Start voice input"
                    aria-label="Start voice input"
                  >
                    <Mic size={19} />
                  </button>

                  <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={!input.trim() && attachedFiles.length === 0}
                    title="Send message"
                    aria-label="Send message"
                  >
                    <ArrowUp size={19} />
                  </button>
                </div>
              </form>
            )}
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
          )}
        </section>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <button className={activeTab === 'HOME' ? 'bottom-active' : ''} onClick={() => navigateTo('HOME')}><House size={19} /><span>Home</span></button>
        <button onClick={() => openWorkflow('Navigate safely: find a safe route and identify nearby risk areas.') }><Map size={19} /><span>Map</span></button>
        <button className={activeTab === 'CHAT' ? 'bottom-active' : ''} onClick={() => navigateTo('CHAT')}><MessageCircle size={19} /><span>Chat</span></button>
        <button className={activeTab === 'QUEUE' ? 'bottom-active' : ''} onClick={() => navigateTo('QUEUE')}><FileText size={19} /><span>Reports</span></button>
        <button className={activeTab === 'DEBUG' ? 'bottom-active' : ''} onClick={() => navigateTo('DEBUG')}><LifeBuoy size={19} /><span>Help</span></button>
      </nav>
    </div>
  );
}

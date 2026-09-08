import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { localLLMEngine } from './realLocalLLM';
import type { RealLLMResult } from './realLocalLLM';
import { Plus, Mic, ArrowUp, X, Paperclip } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'CHAT' | 'QUEUE' | 'DEBUG'>('CHAT');
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
  );
}

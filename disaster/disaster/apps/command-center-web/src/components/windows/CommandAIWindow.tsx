import React, { useState, useEffect, useRef } from 'react';
import { localLLM, AVAILABLE_MODELS, LLMProgress, EOCContext } from '../../services/localLLM';

interface CommandAIWindowProps extends EOCContext {}

type MsgRoute = 'instant' | 'llm' | 'cache';

interface Msg {
  role: 'user' | 'ai';
  text: string;
  route?: MsgRoute;
  ms?: number;
}

export default function CommandAIWindow(props: CommandAIWindowProps) {
  const [selectedModelId, setSelectedModelId] = useState('ollama-auto');
  const [progress, setProgress] = useState<LLMProgress>(localLLM.getProgress());
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [ollamaChecked, setOllamaChecked] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'ai',
      text: '🤖 **EOC Command AI — Smart Routing**\n\nStructured commands (SitRep, Triage, Action Plan, Stale Check) respond **instantly** without any model.\n\nFor open-ended questions, connect **Ollama** for real AI answers.\n\n**Quick start:**\n1. `winget install Ollama.Ollama`\n2. `ollama pull qwen2.5:0.5b` (fastest model)\n3. `ollama serve`\n4. Click **CONNECT**\n\nOr just try the chips below — they work offline!',
      route: 'instant',
    },
  ]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = localLLM.subscribe(p => setProgress(p));
    return unsub;
  }, []);

  useEffect(() => {
    localLLM.checkOllama().then(models => {
      setAvailableOllamaModels(models);
      setOllamaChecked(true);
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConnect = async () => {
    try {
      await localLLM.connect(selectedModelId);
      const p = localLLM.getProgress();
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: `✅ **Connected: ${p.ollamaModel || localLLM.getActiveModel().name}**\n\nI'm ready for any question. Structured commands still respond instantly — only open-ended queries route to the LLM.`,
          route: 'instant',
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: progress.text + '\n\n**Install steps:**\n```\nwinget install Ollama.Ollama\nollama pull qwen2.5:0.5b\nollama serve\n```',
          route: 'instant',
        },
      ]);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const query = (textOverride ?? input).trim();
    if (!query || isGenerating) return;
    if (!textOverride) setInput('');

    const t0 = performance.now();
    setMessages(prev => [...prev, { role: 'user', text: query }]);
    setIsGenerating(true);

    // Placeholder
    setMessages(prev => [...prev, { role: 'ai', text: '', route: undefined }]);

    try {
      let finalRoute: MsgRoute = 'llm';
      await localLLM.generateResponse(query, props, (streamText) => {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'ai', text: streamText, route: undefined };
          return next;
        });
      });

      const elapsed = Math.round(performance.now() - t0);
      // Classify route for display label
      if (elapsed < 200) finalRoute = 'instant';
      else if (elapsed < 600) finalRoute = 'cache';
      else finalRoute = 'llm';

      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], route: finalRoute, ms: elapsed };
        return next;
      });
    } catch {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: 'ai', text: '❌ Generation failed. Try reconnecting.', route: 'llm' };
        return next;
      });
    }

    setIsGenerating(false);
  };

  const isReady = progress.status === 'ready';
  const isConnecting = progress.status === 'connecting';
  const hasError = progress.status === 'error';
  const ollamaDetected = ollamaChecked && availableOllamaModels.length > 0;

  return (
    <div className="fw-body-inner">

      {/* Ollama detection banner */}
      <div className="llm-webgpu-banner">
        <span className={`llm-webgpu-dot ${ollamaDetected ? 'ok' : ollamaChecked ? 'warn' : 'idle'}`} />
        <span className="llm-meta-text">
          {!ollamaChecked
            ? 'Detecting Ollama...'
            : ollamaDetected
            ? `Ollama online — ${availableOllamaModels.length} model${availableOllamaModels.length !== 1 ? 's' : ''}: ${availableOllamaModels.slice(0, 2).join(', ')}${availableOllamaModels.length > 2 ? '…' : ''}`
            : 'Ollama not running — install from ollama.com, then run `ollama serve`'}
        </span>
      </div>

      {/* Speed Mode Indicator */}
      <div className="llm-speed-mode">
        <div className="speed-pill instant-pill">⚡ INSTANT — Structured EOC commands</div>
        <div className={`speed-pill llm-pill ${isReady ? 'active' : 'inactive'}`}>
          🧠 {isReady ? `LLM — ${progress.ollamaModel || 'Connected'}` : 'LLM — Not connected'}
        </div>
      </div>

      {/* Model selector + connect */}
      <div className="llm-model-bar">
        <div className="llm-model-select-row">
          <span className="llm-label">MODEL:</span>
          <select
            value={selectedModelId}
            onChange={e => setSelectedModelId(e.target.value)}
            disabled={isConnecting}
          >
            {AVAILABLE_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button
            className="btn-download-model"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? '⏳ …' : isReady ? '⚡ RECONNECT' : '🔌 CONNECT'}
          </button>
        </div>

        {isConnecting && (
          <div className="llm-progress-container">
            <div className="llm-progress-bar">
              <div className="llm-progress-fill" style={{ width: `${progress.progress}%` }} />
            </div>
            <div className="llm-progress-text">{progress.text}</div>
          </div>
        )}

        {!isConnecting && (
          <div className="llm-status-info">
            <span className={`llm-status-badge ${isReady ? 'ready' : hasError ? 'error' : 'idle'}`}>
              {isReady ? '● ONLINE' : hasError ? '⚠ ERROR' : '○ OFFLINE'}
            </span>
            <span className="llm-meta-text llm-status-text" title={progress.text}>
              {isReady
                ? `${progress.ollamaModel} · num_predict=200 · ctx=1024`
                : progress.text.slice(0, 60) + (progress.text.length > 60 ? '…' : '')}
            </span>
          </div>
        )}
      </div>

      {/* Quick chips */}
      <div className="ai-chips">
        <button className="chip chip-instant" onClick={() => handleSend('sitrep')}>⚡ SitRep</button>
        <button className="chip chip-instant" onClick={() => handleSend('triage active field conflicts')}>⚡ Triage</button>
        <button className="chip chip-instant" onClick={() => handleSend('generate emergency action plan')}>⚡ Action Plan</button>
        <button className="chip chip-instant" onClick={() => handleSend('stale check')}>⚡ Stale Check</button>
        <button className="chip chip-llm"     onClick={() => handleSend('What evacuation route should we prioritize for Sector 4?')}>🧠 Ask AI</button>
      </div>

      {/* Chat */}
      <div className="ai-msgs">
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            {/* Route badge */}
            {m.role === 'ai' && m.route && (
              <div className={`ai-route-badge ${m.route}`}>
                {m.route === 'instant' ? `⚡ INSTANT${m.ms !== undefined ? ` · ${m.ms}ms` : ''}` :
                 m.route === 'cache'   ? `💾 CACHED${m.ms !== undefined ? ` · ${m.ms}ms` : ''}` :
                                         `🧠 LLM${m.ms !== undefined ? ` · ${(m.ms / 1000).toFixed(1)}s` : ''}`}
              </div>
            )}
            {m.text === ''
              ? <span className="ai-thinking">●●●</span>
              : renderMarkdown(m.text)}
          </div>
        ))}
        {isGenerating && (
          <div className="ai-typing-indicator"><span /><span /><span /></div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="ai-input">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={
            isConnecting ? 'Connecting…'
            : isReady ? `Ask anything — fast EOC or LLM (${progress.ollamaModel})…`
            : 'Ask anything — structured queries respond instantly…'
          }
          disabled={isConnecting}
        />
        <button type="submit" disabled={isGenerating || isConnecting || !input.trim()}>
          {isGenerating ? '⏳' : '▶ SEND'}
        </button>
      </form>
    </div>
  );
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, idx, arr) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={idx}>
        {parts.map((part, pi) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={pi}>{part.slice(2, -2)}</strong>
            : <span key={pi}>{part}</span>
        )}
        {idx < arr.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

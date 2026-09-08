// Local LLM Engine — Ollama backend with smart routing
//
// SPEED STRATEGY:
//   1. Structured/tactical queries → instant deterministic engine (0ms)
//   2. Open-ended questions        → Ollama with minimal context + low token limits
//   3. Response cache              → identical queries served instantly from memory
//
// This makes the AI feel instant for 80% of EOC operations.

export interface LLMModel {
  id: string;
  name: string;
  size: string;
  description: string;
  speed: string;
  ollamaTag?: string;
}

export const AVAILABLE_MODELS: LLMModel[] = [
  {
    id: 'ollama-auto',
    name: 'Ollama (Auto-detect, Recommended)',
    size: '0 MB',
    description: 'Uses the fastest available Ollama model automatically.',
    speed: 'CPU native',
    ollamaTag: 'auto',
  },
  {
    id: 'ollama-qwen',
    name: 'Qwen2.5:0.5B (Fastest)',
    size: '~390 MB pulled once',
    description: 'Tiny model. Best for quick decisions.',
    speed: '~25-40 tok/s CPU',
    ollamaTag: 'qwen2.5:0.5b',
  },
  {
    id: 'ollama-smollm',
    name: 'SmolLM2:1.7B (Fast)',
    size: '~1 GB pulled once',
    description: 'Compact and efficient for structured answers.',
    speed: '~15-25 tok/s CPU',
    ollamaTag: 'smollm2:1.7b',
  },
  {
    id: 'ollama-llama3',
    name: 'Llama3.2:1B (Balanced)',
    size: '~1.3 GB pulled once',
    description: 'Good quality, moderate speed.',
    speed: '~10-20 tok/s CPU',
    ollamaTag: 'llama3.2:1b',
  },
  {
    id: 'ollama-phi3',
    name: 'Phi3:mini (Quality)',
    size: '~2.3 GB pulled once',
    description: 'Best quality on CPU but slower.',
    speed: '~5-12 tok/s CPU',
    ollamaTag: 'phi3:mini',
  },
  {
    id: 'offline-rules',
    name: 'Offline Intent Engine (Instant)',
    size: '0 MB — no install',
    description: 'Fully deterministic, zero latency for all EOC commands.',
    speed: '< 1ms',
  },
];

export type LLMBackend = 'ollama' | 'rules';

export interface LLMProgress {
  status: 'idle' | 'connecting' | 'ready' | 'error';
  progress: number;
  text: string;
  backend: LLMBackend | null;
  ollamaModel?: string;
}

export type ProgressCallback = (progress: LLMProgress) => void;

export interface EOCContext {
  areaName: string;
  verifiedCount: number;
  staleCount: number;
  conflictCount: number;
  staleEntities: Array<{ name: string; current_state: string; ageStr: string }>;
  conflicts: Array<{ entity_name: string; count: number }>;
  incidents: Array<{ name: string; sub: string; time: string }>;
}

const OLLAMA_BASE = 'http://localhost:11434';

// ─── Fast response cache (in-memory, keyed by prompt) ────────────────────────
const responseCache = new Map<string, string>();
const CACHE_MAX = 30;

function cacheKey(prompt: string, ctx: EOCContext): string {
  return `${prompt.trim().toLowerCase().slice(0, 80)}|${ctx.verifiedCount}|${ctx.staleCount}|${ctx.conflictCount}`;
}

// ─── Intent classifier ────────────────────────────────────────────────────────
type Intent =
  | 'GREETING'
  | 'SITREP'
  | 'TRIAGE'
  | 'ACTION_PLAN'
  | 'STALE_CHECK'
  | 'DISPATCH'
  | 'HELP'
  | 'OPEN_ENDED';

function classifyIntent(prompt: string): Intent {
  const p = prompt.toLowerCase();
  if (/^(hi|hello|hey|greetings|good\s|who are you)/i.test(p)) return 'GREETING';
  if (p.match(/\b(sitrep|situation report|status report|current status|summary|overview)\b/)) return 'SITREP';
  if (p.match(/\b(triage|conflict|conflicting|resolve|arbitrate)\b/)) return 'TRIAGE';
  if (p.match(/\b(action plan|emergency plan|response plan|what (should|do) we do|next steps)\b/)) return 'ACTION_PLAN';
  if (p.match(/\b(stale|reverif|outdated|old report|unverified|check asset)\b/)) return 'STALE_CHECK';
  if (p.match(/\b(dispatch|send|deploy|mobilize|assign)\b/)) return 'DISPATCH';
  if (p.match(/\b(help|what can you|commands|capabilities)\b/)) return 'HELP';
  return 'OPEN_ENDED';
}

// ─── Deterministic fast engine ────────────────────────────────────────────────
function fastResponse(intent: Intent, ctx: EOCContext): string {
  const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });

  switch (intent) {
    case 'GREETING':
      return `👋 EOC Command AI — ${ctx.areaName} Operations Centre\n\nStatus at ${ts}:\n• ✅ Verified: **${ctx.verifiedCount}** assets\n• ⚠️ Stale: **${ctx.staleCount}** assets\n• 🔴 Conflicts: **${ctx.conflictCount}** reports\n\nAsk me for a SitRep, Triage, Action Plan, or any question.`;

    case 'SITREP': {
      const staleList = ctx.staleEntities.slice(0, 3)
        .map((e, i) => `  ${i + 1}. **${e.name}** — ${e.current_state} (${e.ageStr})`)
        .join('\n');
      const incList = ctx.incidents.slice(0, 3)
        .map((inc, i) => `  ${i + 1}. **${inc.name}** [${inc.sub}] — ${inc.time} ago`)
        .join('\n');
      return (
        `🛰 **SITUATION REPORT** — ${ctx.areaName.toUpperCase()}\n📅 ${ts}\n\n` +
        `**OPERATIONAL STATUS**\n` +
        `• Verified assets: **${ctx.verifiedCount}**\n` +
        `• Stale (unverified): **${ctx.staleCount}** ⚠️\n` +
        `• Active conflicts: **${ctx.conflictCount}** 🔴\n\n` +
        (staleList ? `**PRIORITY ASSETS FOR REVERIFICATION**\n${staleList}\n\n` : '') +
        (ctx.conflicts.length > 0
          ? `**CONFLICT ZONES**\n${ctx.conflicts.slice(0, 3).map((c, i) => `  ${i + 1}. **${c.entity_name}** (${c.count} reports)`).join('\n')}\n\n`
          : '') +
        (incList ? `**ACTIVE INCIDENTS**\n${incList}\n\n` : '') +
        `**RECOMMENDATION:** ${ctx.staleCount > 2 ? `Immediate reverification of ${ctx.staleCount} stale assets required.` : ctx.conflictCount > 0 ? 'Resolve field report conflicts before dispatch.' : '✅ No critical actions pending.'}`
      );
    }

    case 'TRIAGE': {
      if (ctx.conflicts.length === 0) return `✅ **No active conflicts** in ${ctx.areaName}.\n\nAll field reports are consistent.`;
      const items = ctx.conflicts.slice(0, 5).map((c, i) =>
        `  ${i + 1}. **${c.entity_name}** — ${c.count} conflicting reports\n     → **Action:** Request photo-verified update from nearest field unit`
      ).join('\n\n');
      return `⚖️ **CONFLICT TRIAGE** — ${ctx.conflicts.length} conflict${ctx.conflicts.length !== 1 ? 's' : ''}\n\n${items}\n\n**Resolution Protocol:** Accept highest-confidence, most-recent, photo-verified report. Reject unverified radio-only reports.`;
    }

    case 'ACTION_PLAN': {
      const topIncident = ctx.incidents[0];
      return (
        `⚡ **EMERGENCY ACTION PLAN** — ${ctx.areaName}\n\n` +
        (topIncident ? `**Active Incident: ${topIncident.name}**\n\n` : '') +
        `1. 🔴 Establish incident command at nearest verified access point\n` +
        `2. 🚁 Deploy aerial recon for stale zones (${ctx.staleCount} assets unverified)\n` +
        `3. 🚑 Position medical units at sector entry points\n` +
        `4. 🚧 Reroute civilian traffic via alternate corridors\n` +
        `5. 📡 Issue public advisory for affected zones\n` +
        `6. 🔄 Re-ping all ${ctx.staleCount} stale assets within 15 minutes\n\n` +
        `**Priority:** ${ctx.conflictCount > 0 ? `Resolve ${ctx.conflictCount} field conflicts FIRST before committing resources.` : 'Begin deployment immediately — no conflicts pending.'}`
      );
    }

    case 'STALE_CHECK': {
      if (ctx.staleEntities.length === 0) return `✅ **All assets verified** in ${ctx.areaName}. No stale reports.`;
      const list = ctx.staleEntities.map((e, i) =>
        `  ${i + 1}. **${e.name}** (${e.current_state}) — last seen **${e.ageStr}**`
      ).join('\n');
      return `🔍 **STALE ASSET REPORT** — ${ctx.staleEntities.length} assets need reverification\n\n${list}\n\n**Action Required:** Send field units or drone to confirm current state of each asset above.`;
    }

    case 'DISPATCH':
      return `📡 **DISPATCH READY**\n\nUse the **Task Dispatch** panel (bottom-right) to assign tasks to specific field units.\n\nCurrent available entities: **${ctx.verifiedCount}** verified.\nStale assets: **${ctx.staleCount}** — avoid dispatching to unverified zones.`;

    case 'HELP':
      return `🤖 **EOC Command AI — Capabilities**\n\n**Instant commands (offline, 0ms):**\n• "SitRep" — full situation report\n• "Triage" — resolve field conflicts\n• "Action Plan" — emergency response steps\n• "Stale Check" — assets needing verification\n• "Dispatch" — dispatch guidance\n\n**AI-powered (via Ollama):**\n• Any open-ended question\n• "What evacuation route should we use?"\n• "Explain flood risk assessment"\n• "Draft a radio announcement for Zone 4"\n\nTip: Use the quick-action chips for instant structured responses.`;

    default:
      return '';
  }
}

class LocalLLMManager {
  private activeModel: LLMModel = AVAILABLE_MODELS[0];
  private backend: LLMBackend | null = null;
  private connectedOllamaModel: string = '';
  private progress: LLMProgress = {
    status: 'idle',
    progress: 0,
    text: 'Not connected. Select a model and click Connect.',
    backend: null,
  };
  private listeners: Set<ProgressCallback> = new Set();

  public getActiveModel(): LLMModel { return this.activeModel; }
  public getProgress(): LLMProgress { return this.progress; }
  public isReady(): boolean { return this.progress.status === 'ready'; }

  public subscribe(cb: ProgressCallback): () => void {
    this.listeners.add(cb);
    cb(this.progress);
    return () => this.listeners.delete(cb);
  }

  private notify(p: Partial<LLMProgress>) {
    this.progress = { ...this.progress, ...p };
    this.listeners.forEach(cb => cb(this.progress));
  }

  public async checkOllama(): Promise<string[]> {
    try {
      const resp = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2500) });
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.models || []).map((m: any) => m.name as string);
    } catch {
      return [];
    }
  }

  public async connect(modelId: string): Promise<void> {
    const model = AVAILABLE_MODELS.find(m => m.id === modelId) ?? AVAILABLE_MODELS[0];
    this.activeModel = model;
    this.backend = null;
    this.connectedOllamaModel = '';
    responseCache.clear();

    if (model.id === 'offline-rules') {
      this.notify({ status: 'ready', progress: 100, text: '✅ Instant offline engine ready.', backend: 'rules' });
      this.backend = 'rules';
      return;
    }

    this.notify({ status: 'connecting', progress: 20, text: 'Connecting to Ollama...', backend: null });

    const ollamaModels = await this.checkOllama();
    if (ollamaModels.length === 0) {
      this.notify({
        status: 'error', progress: 0,
        text: '❌ Ollama not found. Install from ollama.com, then run `ollama serve`.',
        backend: null,
      });
      throw new Error('Ollama not running');
    }

    // Pick best model
    let targetModel = '';
    if (model.ollamaTag === 'auto') {
      const preferred = ['qwen2.5:0.5b', 'smollm2', 'llama3.2:1b', 'llama3.2', 'phi3:mini', 'phi3', 'qwen2.5', 'gemma3', 'mistral'];
      for (const p of preferred) {
        const found = ollamaModels.find(m => m.startsWith(p.split(':')[0]));
        if (found) { targetModel = found; break; }
      }
      if (!targetModel) targetModel = ollamaModels[0];
    } else {
      const tag = model.ollamaTag!;
      const found = ollamaModels.find(m => m.startsWith(tag.split(':')[0]));
      targetModel = found ?? ollamaModels[0];
    }

    this.notify({ status: 'connecting', progress: 60, text: `Warming up ${targetModel}...`, backend: null });

    try {
      // Quick warm-up ping with minimal tokens
      const warmResp = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: targetModel,
          prompt: 'Hi',
          stream: false,
          options: { num_predict: 5, num_ctx: 512 },
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!warmResp.ok) throw new Error(`Ollama ping failed: ${warmResp.status}`);

      this.connectedOllamaModel = targetModel;
      this.backend = 'ollama';
      this.notify({
        status: 'ready', progress: 100,
        text: `✅ ${targetModel} ready`,
        backend: 'ollama',
        ollamaModel: targetModel,
      });
    } catch (err: any) {
      this.notify({
        status: 'error', progress: 0,
        text: `❌ ${err?.message || 'Connection failed'}`,
        backend: null,
      });
      throw err;
    }
  }

  /** Build a SHORT, focused system prompt — fewer tokens = faster responses */
  private buildSystemPrompt(ctx: EOCContext): string {
    const stale = ctx.staleEntities.slice(0, 4)
      .map(e => `${e.name}(${e.current_state},${e.ageStr})`).join(', ');
    const conflicts = ctx.conflicts.slice(0, 3)
      .map(c => `${c.entity_name}(${c.count} reports)`).join(', ');
    const incidents = ctx.incidents.slice(0, 3)
      .map(i => `${i.name}[${i.sub},${i.time}]`).join(', ');

    return `You are the EOC Command AI for ${ctx.areaName} Emergency Operations Centre. Be concise and direct.
LIVE STATUS: verified=${ctx.verifiedCount}, stale=${ctx.staleCount}, conflicts=${ctx.conflictCount}
${stale ? `Stale assets: ${stale}` : ''}
${conflicts ? `Conflicts: ${conflicts}` : ''}
${incidents ? `Incidents: ${incidents}` : ''}
Answer briefly. Use bullet points. Max 150 words.`;
  }

  public async generateResponse(
    prompt: string,
    context: EOCContext,
    onToken?: (text: string) => void
  ): Promise<string> {
    const intent = classifyIntent(prompt);

    // 1. Fast deterministic path — instant response for structured commands
    if (intent !== 'OPEN_ENDED') {
      const fast = fastResponse(intent, context);
      if (fast) {
        // Simulate quick word-by-word stream for polish
        if (onToken) {
          const words = fast.split(' ');
          let built = '';
          for (let i = 0; i < words.length; i++) {
            await new Promise(r => setTimeout(r, 8));
            built += (i === 0 ? '' : ' ') + words[i];
            onToken(built);
          }
        }
        // Cache it
        const key = cacheKey(prompt, context);
        if (!responseCache.has(key)) {
          if (responseCache.size >= CACHE_MAX) responseCache.delete(responseCache.keys().next().value!);
          responseCache.set(key, fast);
        }
        return fast;
      }
    }

    // 2. Check response cache for open-ended queries
    const key = cacheKey(prompt, context);
    if (responseCache.has(key)) {
      const cached = responseCache.get(key)!;
      if (onToken) {
        const words = cached.split(' ');
        let built = '';
        for (let i = 0; i < words.length; i++) {
          await new Promise(r => setTimeout(r, 6));
          built += (i === 0 ? '' : ' ') + words[i];
          onToken(built);
        }
      }
      return cached;
    }

    // 3. Real LLM for open-ended questions
    if (this.backend === 'ollama' && this.connectedOllamaModel) {
      return this.runOllama(prompt, context, key, onToken);
    }

    // 4. Fallback — no LLM connected
    const fallback = `🤖 **Offline Mode**\n\nQuery: "${prompt}"\n\nConnect Ollama for open-ended AI answers. All structured EOC commands (SitRep, Triage, Action Plan, Stale Check) work instantly without any model.`;
    if (onToken) {
      const words = fallback.split(' ');
      let built = '';
      for (let i = 0; i < words.length; i++) {
        await new Promise(r => setTimeout(r, 10));
        built += (i === 0 ? '' : ' ') + words[i];
        onToken(built);
      }
    }
    return fallback;
  }

  private async runOllama(
    prompt: string,
    context: EOCContext,
    key: string,
    onToken?: (text: string) => void
  ): Promise<string> {
    try {
      const resp = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.connectedOllamaModel,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(context) },
            { role: 'user', content: prompt },
          ],
          stream: true,
          options: {
            temperature: 0.5,
            num_predict: 200,   // ← Hard cap: fast responses only
            num_ctx: 1024,      // ← Small context window = faster
            num_thread: 8,      // ← Use more CPU cores
            repeat_penalty: 1.1,
          },
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!resp.ok) throw new Error(`Ollama error: ${resp.status}`);

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n').filter(l => l.trim())) {
          try {
            const json = JSON.parse(line);
            const token = json?.message?.content ?? '';
            if (token) {
              fullText += token;
              onToken?.(fullText);
            }
          } catch { /* partial line */ }
        }
      }

      // Cache successful response
      if (fullText && responseCache.size < CACHE_MAX) {
        responseCache.set(key, fullText);
      }

      return fullText;
    } catch (err: any) {
      this.backend = null;
      this.notify({ status: 'error', progress: 0, text: 'Connection lost. Click Reconnect.', backend: null });
      const msg = `❌ Connection lost: ${err?.message || 'Unknown error'}. Click **CONNECT** to reconnect.`;
      onToken?.(msg);
      return msg;
    }
  }
}

export const localLLM = new LocalLLMManager();

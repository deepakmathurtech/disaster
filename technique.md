# Voice Waveform Interface — Tech Stack & Technical Implementation Guide

This document details the technologies, web APIs, mathematical algorithms, and architectural techniques used to build the real-time, audio-reactive voice recording interface in the **Field App**.

---

## 🛠️ Technology Stack

| Domain             | Technology / API | Purpose |
|------| :--- | :--- |
| **Framework & UI** | React 18 + TypeScript | Component architecture, type safety, and state management |
| **Styling** | Vanilla CSS3 | Pill-shaped glassmorphism, responsive canvas wrappers, glowing indicators |
| **Audio Capture** | `navigator.mediaDevices.getUserMedia` | Native browser access to raw microphone audio streams |
| **Audio Processing** | Web Audio API (`AudioContext`, `AnalyserNode`) | Real-time acoustic time-domain amplitude & volume analysis |
| **Audio Recording** | `MediaRecorder` API | Captures audio chunks into a persistent `Audio Blob` (`audio/webm`) |
| **Graphics & Animation** | HTML5 Canvas 2D API + `requestAnimationFrame` | High-performance 60fps audio waveform bar visualization |
| **Iconography** | `lucide-react` | Minimal UI controls (`X`, `Square`, `ArrowUp`, `AlertCircle`, `Mic`) |

---

## 🧠 Key Architectural Techniques

### 1. Dual Audio Stream Branching

When the user initiates voice mode, a single `MediaStream` from the microphone is split into two independent, non-blocking pipelines:

```text
                  ┌─────────────────────────────────────┐
                  │    User Microphone (MediaStream)    │
                  └──────────────────┬──────────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      │                             │
                      ▼                             ▼
            Branch A: Visualization         Branch B: Audio Recording
            Web Audio AnalyserNode                MediaRecorder
          (getByteTimeDomainData)               (Audio Chunks)
                      │                             │
                      ▼                             ▼
           RMS Volume Calculation              Audio Blob
                      │                        (audio/webm)
                      ▼                             │
          60fps Full-Width Waveform                 ▼
             Canvas Renderer                Preserved Audio Note
                                            with `<audio controls />`
```

---

### 2. Time-Domain RMS (Root Mean Square) Energy Analysis

Instead of using random number generators (`Math.random()`), keyframe animations, or frequency spectrum equalizers, the visualizer calculates real-time **RMS acoustic energy** from raw time-domain PCM samples:

$$RMS = \sqrt{\frac{1}{N} \sum_{i=0}^{N-1} \left(\frac{\text{sample}_i - 128}{128}\right)^2}$$

- **128 Offset Normalization**: `getByteTimeDomainData` returns byte values from `0` to `255`, where `128` represents zero acoustic pressure (silence). Subtraction normalizes values to $[-1.0, +1.0]$.
- **Acoustic Fidelity**:
  - **Loud speech** $\rightarrow$ High RMS energy $\rightarrow$ Taller vertical bars.
  - **Soft speech** $\rightarrow$ Low RMS energy $\rightarrow$ Shorter vertical bars.
  - **Silence** $\rightarrow$ RMS $\approx 0$ $\rightarrow$ Clean baseline height ($4\text{px}$).

---

### 3. Full-Width Rolling Buffer & Slower Right-to-Left Wave Motion

To achieve a calm, liquid wave flow moving smoothly from right to left across the entire width of the chat input container:

1. **Full Canvas Coverage**: 36 discrete bar positions span 100% of the canvas width without static dots or empty margins.
2. **Buffer Shift Throttling**: The target amplitude array (`targetAmplitudesRef`) shifts leftward every **4 animation frames** (~15 shifts per second at 60fps), pushing the newest RMS volume onto the rightmost end. This slows down the travel speed by 4x (~2.4s to travel across the full screen).
3. **Linear Height Interpolation (Lerp)**: Every frame, bar heights smoothly interpolate towards target heights at 60fps:
   $$\text{current}_i \leftarrow \text{current}_i + (\text{target}_i - \text{current}_i) \times 0.15$$
   This produces a silky-smooth, fluid wave animation without visual steps, jitter, or stutter.

---

### 4. Dynamic MIME Type Detection & Audio Blob Preservation

To ensure wide cross-browser compatibility without external compilation binaries:

```typescript
let mimeType = '';
const candidateTypes = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4'
];

for (const type of candidateTypes) {
  if (MediaRecorder.isTypeSupported(type)) {
    mimeType = type;
    break;
  }
}
```

- When the recording is finalized (`Square` or `ArrowUp` button click), `MediaRecorder` generates a recorded `Blob` and an Object URL (`URL.createObjectURL(blob)`).
- The resulting audio note is stored directly in chat state and rendered with an inline audio player (`<audio controls />`), making the recording ready for downstream LLM / voice backend ingestion.

---

### 5. Strict Lifecycle Resource Cleanup

To eliminate memory leaks, background microphone usage, and unhandled promises:

- **MediaStream Cleanup**: Explicitly invokes `track.stop()` on all active microphone tracks.
- **AudioContext Teardown**: Closes `AudioContext` and detaches `MediaStreamAudioSourceNode`.
- **Animation Teardown**: Cancels pending `requestAnimationFrame` loops via `cancelAnimationFrame(animFrameRef.current)`.
- **MediaRecorder Teardown**: Safely terminates `MediaRecorder` state and clears chunk arrays.

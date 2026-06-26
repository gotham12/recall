# Recall — iOS App

Cognitive care platform for seniors with dementia and memory disorders.  
Built with React + Vite + Capacitor for native iOS deployment.

---

## Prerequisites

- Node.js 18+
- Xcode 15+ (with iOS Simulator or a physical device)
- CocoaPods (`sudo gem install cocoapods`)

---

## First-time Xcode setup (run once)

```bash
cd recall-app
bash setup.sh
```

This script:
1. Installs npm dependencies
2. Builds the React app
3. Adds the Capacitor iOS platform
4. Syncs web assets into the native iOS project
5. Patches `Info.plist` with microphone + camera permissions

Then open Xcode:
```bash
open ios/App/App.xcworkspace
```

Select your simulator or device and press **▶ Run**.

---

## After changing code

Re-sync the built web app into Xcode:

```bash
npm run ios:sync
```

Then run from Xcode again (no rebuild needed if you only changed JavaScript/CSS).

---

## Development (web browser)

```bash
npm run dev
```

Opens on `http://localhost:3000` — full hot-reload.

---

## Login credentials

| Role | How to login |
|---|---|
| Patient | Tap "I'm a Patient" → Enter Dashboard |
| Supervisor | Tap "I'm a Supervisor" → Password: **care2026** |

---

## App structure

| Screen | Description |
|---|---|
| Loading | 1.5 s splash — 3D Möbius strip + "Recall" wordmark |
| Login | Role picker → Patient or Supervisor login with Möbius zoom-in transition |
| Patient Home | State Reconstruction card + scroll-driven Möbius animation + lava lamps + upcoming events |
| Patient Voice | Clara voice companion (tap mic → speak → AI reply → TTS) |
| Patient Meds | Vision-verified medication tracker with camera |
| Patient Events | Full today timeline |
| Patient Score | ACSE demo triggers |
| Supervisor Home | Stats dashboard + patient info |
| Supervisor Events | Full CRUD timeline + caregiver quick notes |
| Supervisor Meds | Medication history with vision confidence |
| Supervisor ACSE | 24-hour score graph + history |
| Supervisor Profile | Edit patient profile |
| Comfort Mode | Grounding → Breathing → Narrative (auto-activates when ACSE < 50) |

---

## Features

- **3D Möbius Strip** — Three.js parametric tube geometry, electric blue metallic material, GPU-composited. Used only on: loading screen, patient home, supervisor home.
- **Scroll-Driven Image Sequence** — `ScrollImageSequence` component: 65 frames, internal scroll (not window), instant DOM frame swap, passive listener. Möbius strip frames pre-baked offscreen via `useMobiusFrames`.
- **Lava Lamps** — Pure CSS `@keyframes`, zero JS overhead, 6 animated blobs.
- **State Reconstruction** — Groq LLM generates a warm one-sentence reality card every 5 minutes.
- **Clara Voice Agent** — Web Speech API STT → Groq LLM → ElevenLabs TTS (browser fallback).
- **Vision Medication** — Cloudflare Workers AI Vision → Gemini Vision → Groq Vision → Google Cloud Vision → manual confirm fallback.
- **ACSE Engine** — Cognitive stability score with auto Comfort Mode at <50.
- **Comfort Mode** — Grounding message + breathing exercise + day narrative + score reset to 70.
- **All local** — IndexedDB (Dexie.js) stores all data on-device. No server required.

---

## API keys

Configured in `.env`:

```
VITE_GROQ_API_KEY=...
VITE_ELEVENLABS_API_KEY=...
VITE_GOOGLE_VISION_KEY=...
```

Production uses Cloudflare Workers AI through the Worker `AI` binding for the primary vision path, so no separate vision API key is required. Optional provider keys such as `GEMINI_API_KEY` should be set as Cloudflare Worker secrets if you want fallbacks.

Graceful fallbacks: ElevenLabs → browser TTS. Workers AI Vision → Gemini Vision → Groq Vision → Google Vision → manual confirm.

---

## Demo scenario

1. Open app → loading screen → login as Patient (Margaret)
2. Home tab shows State Reconstruction card + scroll the Möbius animation
3. Meds tab → "Take Now" on Metformin → show camera → capture → vision confirms
4. Voice tab → tap mic → "What did I do today?" → Clara reads back your day
5. Tap mic again → ask same question → ACSE detects repeat (−15 pts)
6. Score tab → tap "Medication re-attempt" (−20 pts) → watch Comfort Mode activate at <50
7. Breathe through Comfort Mode → exit → score resets to 70
8. Login as Supervisor (care2026) → see full event timeline including the Comfort Mode episode

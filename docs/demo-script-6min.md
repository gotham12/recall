# Recall — 6-Minute Demo Script

**Presenters:** Advaith (impact, features, human story) · Param (technical, UI, architecture)  
**Demo patient:** Margaret Chen, 78 — mild cognitive impairment, living in Shrewsbury  
**Supervisor:** Susan (daughter/caregiver) · Password: `care`  
**Total runtime:** ~6:00

---

## 0:00–0:25 · Cold open (Both)

| Time | Speaker | Say | Screen |
|------|---------|-----|--------|
| 0:00 | **Advaith** | "Every thirty seconds, someone in the US develops Alzheimer's. For families, the hardest moments aren't the diagnosis — they're the quiet afternoons when Mom asks the same question three times, and nobody knows until it's already a crisis." | Browser on login welcome hero |
| 0:15 | **Param** | "Recall is an AI-native cognitive care platform — a patient companion called Clara, a guardian dashboard powered by Recall AI, and an engine that detects decline before crisis." | Hold on Recall wordmark over family photo |
| 0:22 | **Advaith** | "We'll show you Margaret's day, and how her daughter Susan stays connected — in six minutes." | — |

---

## 0:25–1:05 · Login & role selection (Advaith leads)

| Time | Speaker | Say | Screen / Action |
|------|---------|-----|-----------------|
| 0:25 | **Advaith** | "Recall meets people where they are. Large type, calm visuals, no clutter — designed for aging eyes and anxious hands." | **[CLICK]** "I'm a Patient" |
| 0:32 | **Advaith** | "Margaret taps her name. No friction — she shouldn't need to remember a password on a bad day." | **[CLICK]** Margaret Chen in patient list |
| 0:38 | **Param** | "Under the hood, Margaret's profile, meds, routines, and familiar faces live in an offline-first Dexie database — so the app works even when Wi‑Fi doesn't." | Patient PIN screen → **[CLICK]** Continue |
| 0:48 | **Advaith** | "This is Margaret's world. Good afternoon greeting, today's date, her cognitive score at a glance." | **Today tab** loads — scroll slowly through hero |
| 0:55 | **Advaith** | "Safety circle, people who love her, what's coming up — reconstructed so she always knows where she is in her day." | **[SCROLL]** Safety circle → Coming Up cards |
| 1:00 | **Param** | "That timeline is State Reconstruction — events, routines, and meds merged into one readable narrative, not a clinical chart." | Pause on an event card |

---

## 1:05–2:05 · Clara — patient AI backbone (Param leads, Advaith on impact)

| Time | Speaker | Say | Screen / Action |
|------|---------|-----|-----------------|
| 1:05 | **Param** | "Clara is the backbone of the patient interface — voice-first, powered by Workers AI on Cloudflare with Groq and ElevenLabs fallbacks." | **[TAP]** Clara tab |
| 1:12 | **Param** | "She sees everything Margaret sees: meds due, routines, familiar faces, vitals, comfort state — refreshed live from Dexie before every response." | Show Clara UI — flower pulse, clean input bar |
| 1:22 | **Advaith** | "Margaret doesn't talk to a chatbot. She talks to someone who remembers Susan's name, knows she took Donepezil, and speaks like a daughter — not a manual." | **[TAP]** mic **OR type:** "What am I doing today?" → Send |
| 1:35 | **Advaith** | "When she repeats a question within minutes, that's not annoyance — it's a clinical signal. Recall listens for it." | Let Clara respond; optional: mention repeat detection |
| 1:45 | **Param** | "The ACSE — Agentic Cognitive Stability Engine — scores stability in real time. Repeat questions, missed meds, and disorientation deduct points; engagement recovers them." | **[TAP]** Today tab → point at ACSE pill in header |
| 1:55 | **Advaith** | "When score drops below threshold, Comfort Mode activates automatically — before sundowning becomes an ER visit." | — |

---

## 2:05–2:50 · Meds & Comfort Mode (Advaith leads)

| Time | Speaker | Say | Screen / Action |
|------|---------|-----|-----------------|
| 2:05 | **Advaith** | "Medication errors kill 125,000 Americans a year. Margaret verifies every pill with her camera — AI reads the label, confirms the dose, logs it for Susan." | **[TAP]** Meds tab → **[TAP]** a medication → show verify flow (or confirmed state) |
| 2:18 | **Param** | "Vision runs through our Cloudflare Worker — Llama vision on the edge, Google Vision as fallback. Nothing sensitive stays in the browser bundle." | Show confirmed med / camera UI briefly |
| 2:28 | **Advaith** | "If Margaret spirals, Comfort Mode wraps her in grounding breath, familiar photos, and calm audio." | Trigger Comfort Mode (demo or ACSE path) **OR** **[SETTINGS/DEMO]** if using golden path |
| 2:40 | **Advaith** | "Susan gets an alert. Not after the crisis — during the drift." | Comfort overlay visible — nature, breathing copy |
| 2:48 | **Param** | "Comfort Mode is patient-only overlay — guardians control it remotely without leaving their dashboard." | **[DISMISS]** comfort if needed |

---

## 2:50–3:35 · Switch to supervisor (Both)

| Time | Speaker | Say | Screen / Action |
|------|---------|-----|-----------------|
| 2:50 | **Advaith** | "Now Susan's phone. Same app, different lens — she sees everything Margaret sees, plus what Margaret can't." | **[TAP]** avatar → Switch user → login |
| 2:58 | **Param** | "Supervisor auth is a separate path — password-gated, same Margaret data, synced through IndexedDB and a Cloudflare sync bridge." | **[CLICK]** "I'm a Supervisor" → Margaret → password `care` |
| 3:05 | **Advaith** | "Susan opens Overview. ACSE score, today's events, med logs, vitals from Apple Health, Margaret's full profile — meds, allergies, emergency note." | **Overview tab** — scroll top to bottom |
| 3:18 | **Param** | "Every widget reads from the same Dexie store Clara uses — one source of truth, no stale copies." | **[SCROLL]** Patient profile, meds list, Safety Circle |
| 3:28 | **Advaith** | "She can activate Comfort Mode for Margaret remotely — calming the patient without trapping the caregiver in the patient UI." | Point at Comfort Mode CTA (don't activate unless rehearsed) |

---

## 3:35–4:35 · Recall AI — supervisor backbone (Param leads)

| Time | Speaker | Say | Screen / Action |
|------|---------|-----|-----------------|
| 3:35 | **Param** | "Recall AI is the supervisor backbone — the clinical advisor to Clara's companion. It loads a full briefing snapshot: ACSE history, med adherence, alerts since last check-in, Clara conversations." | **[TAP]** Recall AI tab |
| 3:45 | **Param** | "Context reloads before every message and every twenty seconds — so Susan always asks questions against live data." | Wait for welcome briefing to appear |
| 3:52 | **Advaith** | "Susan isn't reading raw logs at midnight. She gets: Donepezil taken, walk missed, ACSE dipped at 4 PM — in plain English." | Read first lines of briefing aloud (abbreviated) |
| 4:00 | **Param** | "Watch the stack: React and TypeScript frontend, Dexie offline DB, Cloudflare Workers for LLM/TTS/vision, GitHub Pages deploy, optional Supabase path for sync." | **[TAP]** preprompt: "Explain Margaret's ACSE score today" |
| 4:12 | **Advaith** | "She can ask what to bring to Dr. Chen's checkup — Recall AI connects cognitive trends to actionable caregiver questions." | Let Recall AI respond |
| 4:22 | **Param** | "UI stays clean — transparent input, no gray form chrome, two focused preprompts. Voice works here too." | Show input bar, optional mic tap |
| 4:30 | **Advaith** | "This is the product thesis: Clara holds the patient's hand. Recall AI holds the family's." | — |

---

## 4:35–5:25 · Insights & schedule (Param + Advaith)

| Time | Speaker | Say | Screen / Action |
|------|---------|-----|-----------------|
| 4:35 | **Param** | "Insights tab — real ACSE trend from stored scores, weekly med adherence, vitals dashboard, storm radar for sundowning risk windows." | **[TAP]** Insights → scroll Score Snapshot, Weekly Summary |
| 4:48 | **Advaith** | "Schedule shows what's ahead; ACSE tab charts the cognitive weather over time." | **[TAP]** Schedule → one event **[TAP]** ACSE tab briefly |
| 4:58 | **Advaith** | "When Susan sends warmth through Presence Bridge, Margaret feels it — a tap that says 'I'm thinking of you' without a phone call she might not answer." | Optional: mention if feature visible on patient side |
| 5:08 | **Param** | "Tech stack in one line: Vite, React 18, Zustand, Dexie, GSAP motion, Recharts, Capacitor-ready for iOS HealthKit." | Return to Overview |
| 5:18 | **Advaith** | "Margaret keeps her dignity. Susan keeps her sanity. Clinicians get signal, not noise." | Overview hero moment |

---

## 5:25–6:00 · Close (Both)

| Time | Speaker | Say | Screen |
|------|---------|-----|--------|
| 5:25 | **Advaith** | "Recall doesn't replace caregivers — it extends them. Early signal, automatic de-escalation, and AI that knows the whole person, not just their chart." | Split screen feel — optional quick **[TAP]** back to patient Today tab |
| 5:38 | **Param** | "We're production-deployed on GitHub Pages with a Cloudflare Worker API, full offline demo data, and a six-minute golden path that tells Margaret's story end to end." | Login hero or Recall wordmark |
| 5:48 | **Advaith** | "If someone you love is forgetting, you shouldn't have to guess." | — |
| 5:52 | **Both** | "We're Advaith and Param. That's Recall." | Smile — hold on logo |
| 6:00 | — | **END** | — |

---

## Pre-demo checklist

- [ ] Hard-refresh deployed app (cache bust)
- [ ] Margaret seeded with photo, meds, events
- [ ] Supervisor password: `care`
- [ ] Mic permission granted for Clara / Recall AI voice beats
- [ ] Browser zoom 100%, mobile viewport or phone mirroring if presenting
- [ ] Close extra tabs; Do Not Disturb on
- [ ] Rehearse Comfort Mode entry/exit once
- [ ] If live LLM fails, local fallbacks still demo — mention "edge AI" either way

## Timing notes

- **Pace:** ~150 words/min combined — script is tight; skip pauses if running long
- **Flex cuts:** Shorten Insights (4:35–5:08) or Golden Path mention if under time pressure
- **Flex adds:** Live Clara question + Recall AI follow-up is the highest-impact 30 seconds — protect 1:22–1:35 and 3:52–4:12

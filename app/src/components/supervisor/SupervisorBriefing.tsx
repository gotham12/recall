import { useCallback, useEffect, useState } from 'react';
import StudioIcon from '../StudioIcon';
import { useAppStore } from '../../store/appStore';
import type { User } from '../../db/db';
import {
  formatBriefingContext,
  gatherSupervisorBriefingSnapshot,
  localSupervisorBriefing,
  markSupervisorCheckIn,
  validateBriefingAgainstSnapshot,
  type SupervisorBriefingSnapshot,
} from '../../lib/supervisorBriefing';
import { generateSupervisorBriefing } from '../../services/groq';

interface Props {
  user: User | null;
  /** When true, marks supervisor check-in after briefing loads (Recall AI tab entry). */
  markCheckInOnLoad?: boolean;
}

export default function SupervisorBriefing({ user, markCheckInOnLoad = false }: Props) {
  const acseScore = useAppStore((s) => s.acseScore);
  const comfortModeActive = useAppStore((s) => s.comfortModeActive);
  const [briefing, setBriefing] = useState('');
  const [loading, setLoading] = useState(true);
  const [fromLlm, setFromLlm] = useState(false);
  const [snapshot, setSnapshot] = useState<SupervisorBriefingSnapshot | null>(null);
  const [highlights, setHighlights] = useState<{ label: string; value: string; tone?: 'ok' | 'warn' | 'alert' }[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadBriefing = useCallback(async (cancelled: () => boolean) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const snap = await gatherSupervisorBriefingSnapshot(user, acseScore, comfortModeActive);
      const context = formatBriefingContext(snap);
      const fallback = localSupervisorBriefing(snap);
      const result = await generateSupervisorBriefing(context, fallback);
      const validated = result.fromLlm
        ? validateBriefingAgainstSnapshot(result.text, snap)
        : result.text;

      if (cancelled()) return;

      setSnapshot(snap);
      setBriefing(validated);
      setFromLlm(result.fromLlm);

      const threshold = snap.comfortThreshold;
      const acseTone: 'ok' | 'warn' | 'alert' =
        acseScore >= 75 ? 'ok' : acseScore >= threshold ? 'warn' : 'alert';

      setHighlights([
        { label: 'ACSE', value: String(acseScore), tone: acseTone },
        {
          label: 'Meds confirmed',
          value: snap.medsTakenToday.length ? `${snap.medsTakenToday.length} today` : 'None yet',
          tone: snap.medsPending.length || snap.dueMedsNow.length ? 'warn' : 'ok',
        },
        {
          label: 'Next checkup',
          value: snap.nextCheckup ? snap.nextCheckup.split(' — ')[0] : 'None scheduled',
          tone: snap.nextCheckup ? 'ok' : undefined,
        },
        {
          label: 'Clara today',
          value: snap.claraConversations.length ? `${snap.claraConversations.length} talk(s)` : 'No talks logged',
        },
        {
          label: 'Comfort Mode',
          value: comfortModeActive ? 'Active' : 'Off',
          tone: comfortModeActive ? 'alert' : 'ok',
        },
        {
          label: 'Last visit',
          value: snap.lastCheckInLabel,
        },
      ]);

      if (markCheckInOnLoad && user.id) {
        markSupervisorCheckIn(user.id);
      }
    } catch (err) {
      console.error('[SupervisorBriefing]', err);
      if (!cancelled()) {
        const name = user?.name?.split(' ')[0] ?? 'the patient';
        setBriefing(`I couldn't load ${name}'s latest update right now. Tap Refresh or check the Overview tab for live data.`);
        setFromLlm(false);
      }
    } finally {
      if (!cancelled()) setLoading(false);
    }
  }, [user, acseScore, comfortModeActive, markCheckInOnLoad]);

  useEffect(() => {
    let cancelled = false;
    void loadBriefing(() => cancelled);
    return () => { cancelled = true; };
  }, [loadBriefing, refreshKey]);

  const firstName = user?.name?.split(' ')[0] ?? 'Margaret';

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleAcknowledge = () => {
    if (user?.id) markSupervisorCheckIn(user.id);
  };

  return (
    <div className="recall-ai-panel">
      <section className="supervisor-briefing app-card" style={{ padding: '18px 16px' }}>
        <div className="supervisor-briefing__header">
          <div className="supervisor-briefing__avatar" aria-hidden>
            <StudioIcon name="clara" size={22} />
          </div>
          <div>
            <p className="supervisor-briefing__eyebrow">Recall Care Assistant</p>
            <h2 className="supervisor-briefing__title">Briefing for {firstName}</h2>
          </div>
          {!loading && (
            <span className="supervisor-briefing__badge">
              {fromLlm ? 'AI summary' : 'Grounded summary'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="supervisor-briefing__loading">
            <div className="supervisor-briefing__shimmer" />
            <div className="supervisor-briefing__shimmer supervisor-briefing__shimmer--short" />
            <p className="supervisor-briefing__loading-text">
              Pulling meds, events, Clara logs, and ACSE from {firstName}'s day…
            </p>
          </div>
        ) : (
          <>
            <p className="supervisor-briefing__body">{briefing}</p>
            {highlights.length > 0 && (
              <div className="supervisor-briefing__stats">
                {highlights.map((h) => (
                  <div
                    key={h.label}
                    className={`supervisor-briefing__stat${h.tone ? ` supervisor-briefing__stat--${h.tone}` : ''}`}
                  >
                    <span className="supervisor-briefing__stat-label">{h.label}</span>
                    <span className="supervisor-briefing__stat-value">{h.value}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="recall-ai-panel__actions">
              <button type="button" className="recall-ai-panel__btn tap-feedback" onClick={handleRefresh}>
                <StudioIcon name="refresh" size={16} /> Refresh
              </button>
              <button type="button" className="recall-ai-panel__btn recall-ai-panel__btn--primary tap-feedback" onClick={handleAcknowledge}>
                Mark check-in complete
              </button>
            </div>
          </>
        )}
      </section>

      {snapshot && !loading && (
        <section className="recall-ai-facts app-card" style={{ padding: '16px' }}>
          <h3 className="recall-ai-facts__title">Data sources (ground truth)</h3>
          <p className="recall-ai-facts__sub">Recall AI only uses these live signals — no guessing.</p>
          <ul className="recall-ai-facts__list">
            {snapshot.nextCheckup && (
              <li><strong>Checkup:</strong> {snapshot.nextCheckup}</li>
            )}
            {snapshot.upcomingToday.map((u) => (
              <li key={u}><strong>Coming up:</strong> {u}</li>
            ))}
            {snapshot.medsTakenToday.map((m) => (
              <li key={m}><strong>Med confirmed:</strong> {m}</li>
            ))}
            {snapshot.medsUnconfirmed.map((m) => (
              <li key={m}><strong>Unverified:</strong> {m}</li>
            ))}
            {snapshot.dueMedsNow.map((m) => (
              <li key={m}><strong>Due now:</strong> {m}</li>
            ))}
            {snapshot.claraConversations.map((c, i) => (
              <li key={i}><strong>Clara:</strong> {c}</li>
            ))}
            {snapshot.acseSignalsSinceCheckIn.map((s, i) => (
              <li key={i}><strong>ACSE signal:</strong> {s}</li>
            ))}
            {snapshot.completedToday.slice(0, 3).map((c) => (
              <li key={c}><strong>Done today:</strong> {c}</li>
            ))}
            {!snapshot.nextCheckup && !snapshot.upcomingToday.length && !snapshot.medsTakenToday.length
              && !snapshot.claraConversations.length && (
              <li>No new activity recorded since last check-in.</li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

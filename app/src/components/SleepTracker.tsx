import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAppStore } from '../store/appStore';
import StudioIcon from './StudioIcon';
import {
  analyzeSleep,
  dateKey,
  formatSleepDuration,
  lastNightDate,
  nightMetrics,
  qualityLabel,
} from '../lib/sleep';
import {
  connectAppleHealth,
  disconnectAppleHealth,
  getAppleHealthMeta,
  isAppleHealthConnected,
  syncAppleWatchSleep,
} from '../lib/appleHealthSleep';

const SLEEP_TIPS = [
  'Try to go to bed around the same time each night.',
  'Dim the lights on the porch an hour before bed.',
  'A warm cup of chamomile tea can help you wind down.',
  'If you wake up, take slow breaths — you are safe at home.',
];

interface SleepTrackerProps {
  /** Full-page sleep dashboard (dedicated tab) */
  dashboard?: boolean;
}

export default function SleepTracker({ dashboard = false }: SleepTrackerProps) {
  const { user } = useAppStore();
  const [expanded, setExpanded] = useState(dashboard);
  const [bedHour, setBedHour] = useState('22');
  const [bedMin, setBedMin] = useState('00');
  const [wakeHour, setWakeHour] = useState('07');
  const [wakeMin, setWakeMin] = useState('00');
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [awakenings, setAwakenings] = useState(1);
  const [saved, setSaved] = useState(false);
  const [watchConnected, setWatchConnected] = useState(false);
  const [watchSyncing, setWatchSyncing] = useState(false);
  const [watchMeta, setWatchMeta] = useState(getAppleHealthMeta(user?.id ?? 0));

  const logs = useLiveQuery(
    () => (user?.id ? db.sleepLogs.where('userId').equals(user.id).sortBy('date') : []),
    [user?.id]
  ) ?? [];

  const report = analyzeSleep(logs);
  const lastNight = logs.find((l) => l.date === lastNightDate());
  const lastMetrics = lastNight ? nightMetrics(lastNight) : null;
  const firstName = user?.name?.split(' ')[0] ?? 'friend';

  useEffect(() => {
    if (!user?.id) return;
    const connected = isAppleHealthConnected(user.id);
    setWatchConnected(connected);
    setWatchMeta(getAppleHealthMeta(user.id));
    if (connected && dashboard) {
      void syncAppleWatchSleep(user.id);
    }
  }, [user?.id, dashboard]);

  const handleConnectWatch = async () => {
    if (!user?.id) return;
    setWatchSyncing(true);
    try {
      const state = await connectAppleHealth(user.id);
      setWatchConnected(true);
      setWatchMeta(state);
      await syncAppleWatchSleep(user.id);
    } finally {
      setWatchSyncing(false);
    }
  };

  const handleSyncWatch = async () => {
    if (!user?.id) return;
    setWatchSyncing(true);
    try {
      await syncAppleWatchSleep(user.id);
      setWatchMeta(getAppleHealthMeta(user.id));
    } finally {
      setWatchSyncing(false);
    }
  };

  const handleDisconnectWatch = () => {
    if (!user?.id) return;
    disconnectAppleHealth(user.id);
    setWatchConnected(false);
    setWatchMeta({ connected: false });
  };

  const logSleep = async () => {
    if (!user?.id) return;
    const night = lastNightDate();
    const bed = new Date(`${night}T${bedHour.padStart(2, '0')}:${bedMin.padStart(2, '0')}:00`);
    const wake = new Date(`${dateKey()}T${wakeHour.padStart(2, '0')}:${wakeMin.padStart(2, '0')}:00`);

    const existing = await db.sleepLogs.where('userId').equals(user.id).filter((l) => l.date === night).first();
    const entry = {
      userId: user.id,
      date: night,
      bedTime: bed.toISOString(),
      wakeTime: wake.toISOString(),
      quality,
      awakenings,
      loggedBy: 'patient' as const,
    };

    if (existing?.id) await db.sleepLogs.update(existing.id, entry);
    else await db.sleepLogs.add(entry);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (!dashboard) setExpanded(false);
  };

  if (!user?.id) return null;

  return (
    <div className={dashboard ? 'sleep-dashboard' : undefined}>
      {dashboard && (
        <header className="sleep-dashboard__hero">
          <div className="sleep-dashboard__hero-icon">
            <StudioIcon name="moon" size={32} />
          </div>
          <div>
            <h1 className="sleep-dashboard__title">{firstName}&apos;s sleep</h1>
            <p className="sleep-dashboard__sub">
              Restful sleep helps memory, mood, and brain health. Log each morning so Susan can follow along.
            </p>
          </div>
        </header>
      )}

      <section className={`sleep-tracker card ${dashboard ? 'sleep-tracker--dashboard' : ''}`}>
        <div className="sleep-tracker__header">
          <div className="sleep-tracker__icon-wrap">
            <StudioIcon name="moon" size={24} />
          </div>
          <div className="sleep-tracker__head-text">
            <h3 className="sleep-tracker__title">{dashboard ? 'Last night' : 'Sleep'}</h3>
            <p className="sleep-tracker__sub">
              {lastMetrics
                ? `${formatSleepDuration(lastMetrics.durationHours)} · ${qualityLabel(lastNight!.quality)} · ${lastMetrics.efficiency}% efficiency`
                : 'Log how you slept last night'}
            </p>
          </div>
          {!dashboard && (
            <button
              type="button"
              className="studio-btn studio-btn--ghost tap-feedback sleep-tracker__log-btn"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Cancel' : lastNight ? 'Update' : 'Log'}
            </button>
          )}
        </div>

        {lastMetrics && (
          <div className="sleep-tracker__stats">
            <div className="sleep-stat">
              <span className="sleep-stat__value">{formatSleepDuration(lastMetrics.durationHours)}</span>
              <span className="sleep-stat__label">Duration</span>
            </div>
            <div className="sleep-stat">
              <span className="sleep-stat__value">{lastMetrics.efficiency}%</span>
              <span className="sleep-stat__label">Efficiency</span>
            </div>
            <div className="sleep-stat">
              <span className="sleep-stat__value">{lastMetrics.awakenings}</span>
              <span className="sleep-stat__label">Wake-ups</span>
            </div>
            {dashboard && (
              <div className="sleep-stat">
                <span className="sleep-stat__value">{report.avgDuration > 0 ? formatSleepDuration(report.avgDuration) : '—'}</span>
                <span className="sleep-stat__label">7-day avg</span>
              </div>
            )}
          </div>
        )}

        {report.nights.length > 0 && (
          <div className="sleep-tracker__week">
            <p className="sleep-tracker__week-label">{dashboard ? 'Sleep history' : 'Past week'}</p>
            <div className={`sleep-week-chart ${dashboard ? 'sleep-week-chart--tall' : ''}`}>
              {(dashboard ? report.nights.slice(-14) : report.nights.slice(-7)).map((n) => (
                <div key={n.date} className="sleep-week-bar" title={`${n.date}: ${formatSleepDuration(n.durationHours)}`}>
                  <div
                    className="sleep-week-bar__fill"
                    style={{ height: `${Math.min(100, (n.durationHours / 9) * 100)}%` }}
                  />
                  <span className="sleep-week-bar__day">
                    {new Date(n.date + 'T12:00:00').toLocaleDateString([], { weekday: 'narrow' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(expanded || dashboard) && (
          <div className="sleep-tracker__form animate-fadeIn">
            <p className="sleep-tracker__form-title">How did you sleep last night?</p>

            <div className="sleep-form-row">
              <label className="sleep-form-label">
                Bedtime
                <div className="sleep-time-inputs">
                  <select className="studio-select" value={bedHour} onChange={(e) => setBedHour(e.target.value)}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i)}>{String(i).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span>:</span>
                  <select className="studio-select" value={bedMin} onChange={(e) => setBedMin(e.target.value)}>
                    {['00', '15', '30', '45'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="sleep-form-label">
                Wake time
                <div className="sleep-time-inputs">
                  <select className="studio-select" value={wakeHour} onChange={(e) => setWakeHour(e.target.value)}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i)}>{String(i).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span>:</span>
                  <select className="studio-select" value={wakeMin} onChange={(e) => setWakeMin(e.target.value)}>
                    {['00', '15', '30', '45'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            <label className="sleep-form-label">
              Sleep quality
              <div className="sleep-quality-row">
                {([1, 2, 3, 4, 5] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`sleep-quality-btn tap-feedback ${quality >= q ? 'sleep-quality-btn--on' : ''}`}
                    onClick={() => setQuality(q)}
                    aria-label={qualityLabel(q)}
                  >
                    <StudioIcon name="moon" size={18} />
                  </button>
                ))}
              </div>
            </label>

            <label className="sleep-form-label">
              Times woken up
              <div className="sleep-awakenings">
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`studio-chip tap-feedback ${awakenings === n ? 'studio-chip--active' : ''}`}
                    onClick={() => setAwakenings(n)}
                  >
                    {n === 4 ? '4+' : n}
                  </button>
                ))}
              </div>
            </label>

            <button type="button" className="studio-btn studio-btn--primary tap-feedback" onClick={() => void logSleep()}>
              {saved ? 'Saved!' : 'Save sleep log'}
            </button>
          </div>
        )}
      </section>

      {dashboard && (
        <>
          <section className="sleep-watch card">
            <div className="sleep-watch__header">
              <div className="sleep-watch__icon">
                <StudioIcon name="heart" size={22} />
              </div>
              <div>
                <h3 className="sleep-watch__title">Apple Watch</h3>
                <p className="sleep-watch__sub">
                  {watchConnected
                    ? `Connected to ${watchMeta.deviceName ?? 'Apple Watch'} via Apple Health`
                    : 'Pull sleep stages and wake times from Margaret\'s watch'}
                </p>
              </div>
            </div>

            {watchConnected ? (
              <div className="sleep-watch__actions">
                {watchMeta.lastSyncAt && (
                  <p className="sleep-watch__synced">
                    Last synced {new Date(watchMeta.lastSyncAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                    {lastNight?.loggedBy === 'apple_watch' && ' · from watch'}
                  </p>
                )}
                <button
                  type="button"
                  className="studio-btn studio-btn--primary tap-feedback"
                  disabled={watchSyncing}
                  onClick={() => void handleSyncWatch()}
                >
                  {watchSyncing ? 'Syncing…' : 'Sync from Apple Health'}
                </button>
                <button
                  type="button"
                  className="studio-btn studio-btn--text tap-feedback"
                  onClick={handleDisconnectWatch}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="studio-btn studio-btn--primary tap-feedback"
                disabled={watchSyncing}
                onClick={() => void handleConnectWatch()}
              >
                {watchSyncing ? 'Connecting…' : 'Connect Apple Watch'}
              </button>
            )}

            <p className="sleep-watch__note">
              Sleep data flows through Apple Health. On iPhone, open Health → Browse → Sleep to verify permissions.
            </p>
          </section>

          <section className="sleep-tips card">
            <h3 className="studio-section-title">Evening wind-down tips</h3>
            <ul className="sleep-tips__list">
              {SLEEP_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>

          {report.interpretation[0] && (
            <section className="sleep-insight card">
              <StudioIcon name="heart" size={20} />
              <p>{report.interpretation[0]}</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

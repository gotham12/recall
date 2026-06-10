import { useLiveQuery } from 'dexie-react-hooks';
import { db, type AcseScore, type Event } from '../../db/db';
import { useAppStore } from '../../store/appStore';
import StudioIcon, { type IconName } from '../StudioIcon';

function iconFor(type: string): IconName {
  if (type === 'system_alert') return 'warning';
  if (type === 'caregiver_input') return 'user';
  if (type === 'planned') return 'calendar';
  return 'success';
}

export default function LiveActivityFeed({ limit = 8 }: { limit?: number }) {
  const { user } = useAppStore();

  const events = useLiveQuery<Event[]>(
    () =>
      user?.id
        ? db.events.where('userId').equals(user.id).reverse().limit(limit).toArray()
        : [],
    [user?.id, limit]
  ) ?? [];

  const scores = useLiveQuery<AcseScore[]>(
    () =>
      user?.id
        ? db.acseScores.where('userId').equals(user.id).reverse().limit(5).toArray()
        : [],
    [user?.id]
  ) ?? [];

  const feed = [
    ...events.map((e) => ({
      id: `e-${e.id}`,
      time: e.timestamp,
      title: e.title,
      detail: e.description,
      icon: iconFor(e.type),
    })),
    ...scores.map((s) => ({
      id: `s-${s.id}`,
      time: s.timestamp,
      title: `ACSE → ${s.score}`,
      detail: s.reason ?? 'Score update',
      icon: 'score' as IconName,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, limit);

  return (
    <section className="live-feed card">
      <h3 className="studio-section-title">Live Activity Feed</h3>
      {feed.length === 0 ? (
        <p className="studio-text-muted">No activity yet today.</p>
      ) : (
        <ul className="live-feed__list">
          {feed.map((item) => (
            <li key={item.id} className="live-feed__item">
              <StudioIcon name={item.icon} size={18} />
              <div>
                <p className="live-feed__title">{item.title}</p>
                <p className="live-feed__detail">{item.detail}</p>
                <time className="live-feed__time">
                  {new Date(item.time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

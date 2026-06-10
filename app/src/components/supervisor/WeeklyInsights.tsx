import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../../store/appStore';
import { db, type AcseScore, type CareJournalEntry } from '../../db/db';
import StudioIcon from '../StudioIcon';

export default function WeeklyInsights() {
  const { user } = useAppStore();

  const scores = useLiveQuery<AcseScore[]>(
    () =>
      user?.id
        ? db.acseScores
            .where('userId')
            .equals(user.id)
            .and((s) => {
              const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              return new Date(s.timestamp) > cutoff;
            })
            .toArray()
        : [],
    [user?.id]
  ) ?? [];

  const journal = useLiveQuery<CareJournalEntry[]>(
    () =>
      user?.id
        ? db.careJournal
            .where('userId')
            .equals(user.id)
            .and((j) => {
              const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              return new Date(j.timestamp) > cutoff;
            })
            .toArray()
        : [],
    [user?.id]
  ) ?? [];

  const comfortEpisodes = scores.filter((s) => s.score < 50).length;
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)
      : null;

  const moodCounts = { great: 0, good: 0, okay: 0, difficult: 0 };
  journal.forEach((j) => { moodCounts[j.mood]++; });

  const dayBuckets: Record<string, { day: string; low: number; avg: number }> = {};
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  scores.forEach((s) => {
    const d = days[new Date(s.timestamp).getDay()];
    if (!dayBuckets[d]) dayBuckets[d] = { day: d, low: 0, avg: 0 };
    dayBuckets[d].avg += s.score;
    if (s.score < 50) dayBuckets[d].low++;
  });
  const chartData = Object.values(dayBuckets).map((b) => ({
    day: b.day,
    avg: Math.round(b.avg / Math.max(1, scores.filter((s) => days[new Date(s.timestamp).getDay()] === b.day).length)),
    dips: b.low,
  }));

  const insights: string[] = [];
  if (comfortEpisodes > 0) insights.push(`${comfortEpisodes} Comfort Mode episode(s) this week — review sundowning patterns.`);
  if (moodCounts.difficult > moodCounts.great) insights.push('Journal mood trending difficult — consider increasing check-in frequency.');
  if (avgScore !== null && avgScore < 70) insights.push(`Weekly average ACSE ${avgScore} — below target; reinforce routine and warmth pulses.`);
  if (insights.length === 0) insights.push('Stable week so far. Keep routines consistent and log daily journal notes.');

  return (
    <section className="weekly-insights card">
      <div className="weekly-insights__header">
        <StudioIcon name="calendar" size={22} />
        <h3 className="studio-section-title" style={{ margin: 0 }}>Weekly Care Insights</h3>
      </div>

      <div className="weekly-insights__stats">
        <div><strong>{avgScore ?? '—'}</strong><span>7-day avg ACSE</span></div>
        <div><strong>{comfortEpisodes}</strong><span>Comfort episodes</span></div>
        <div><strong>{journal.length}</strong><span>Journal entries</span></div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="avg" fill="var(--recall-petal)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      <ul className="weekly-insights__tips">
        {insights.map((tip) => (
          <li key={tip}><StudioIcon name="clara" size={16} /> {tip}</li>
        ))}
      </ul>
    </section>
  );
}

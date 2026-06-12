import { useLiveQuery } from 'dexie-react-hooks';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend, Cell,
} from 'recharts';
import { useAppStore } from '../../store/appStore';
import { db, type AcseScore, type CareJournalEntry } from '../../db/db';
import StudioIcon from '../StudioIcon';

const MOOD_COLORS: Record<string, string> = {
  great: '#10B981',
  good: '#34C759',
  okay: '#F59E0B',
  difficult: '#EF4444',
};

export default function WeeklyInsights() {
  const { user } = useAppStore();

  const scores = useLiveQuery<AcseScore[]>(
    () =>
      user?.id
        ? db.acseScores
            .where('userId')
            .equals(user.id)
            .and((s) => new Date(s.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
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
            .and((j) => new Date(j.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
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
  journal.forEach((j) => { moodCounts[j.mood as keyof typeof moodCounts]++; });

  // Build ordered 7-day chart data
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date().getDay();
  const orderedDays = Array.from({ length: 7 }, (_, i) => days[(today - 6 + i + 7) % 7]);

  const dayBuckets: Record<string, { scores: number[]; dips: number; journal: number }> = {};
  orderedDays.forEach((d) => { dayBuckets[d] = { scores: [], dips: 0, journal: 0 }; });

  scores.forEach((s) => {
    const d = days[new Date(s.timestamp).getDay()];
    if (dayBuckets[d]) {
      dayBuckets[d].scores.push(s.score);
      if (s.score < 50) dayBuckets[d].dips++;
    }
  });
  journal.forEach((j) => {
    const d = days[new Date(j.timestamp).getDay()];
    if (dayBuckets[d]) dayBuckets[d].journal++;
  });

  // Running 3-day average for trend line
  const rawAvgs = orderedDays.map((d) => {
    const b = dayBuckets[d];
    return b.scores.length ? Math.round(b.scores.reduce((a, n) => a + n, 0) / b.scores.length) : null;
  });

  const chartData = orderedDays.map((d, i) => {
    const b = dayBuckets[d];
    const avg = b.scores.length
      ? Math.round(b.scores.reduce((a, n) => a + n, 0) / b.scores.length)
      : null;

    // 3-day rolling average
    const window = rawAvgs.slice(Math.max(0, i - 2), i + 1).filter((v): v is number => v !== null);
    const trend = window.length ? Math.round(window.reduce((a, b) => a + b, 0) / window.length) : null;

    return { day: d, avg, dips: b.dips, journal: b.journal, trend };
  });

  // Mood distribution data
  const moodData = Object.entries(moodCounts)
    .filter(([, count]) => count > 0)
    .map(([mood, count]) => ({ mood: mood.charAt(0).toUpperCase() + mood.slice(1), count, fill: MOOD_COLORS[mood] }));

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

      {/* Multi-series daily chart */}
      {chartData.some((d) => d.avg !== null) && (
        <>
          <p style={{ fontSize: 12, color: 'var(--studio-text-muted)', margin: '12px 0 6px' }}>Daily avg ACSE · critical dips · 3-day trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--studio-border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="score" domain={[0, 100]} tick={{ fontSize: 10 }} ticks={[0, 50, 75, 100]} />
              <YAxis yAxisId="dips" orientation="right" tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 13, borderRadius: 10 }}
                formatter={(value: number, name: string) => {
                  if (name === 'avg') return [`${value}`, 'Avg ACSE'];
                  if (name === 'dips') return [`${value}`, 'Critical dips'];
                  if (name === 'trend') return [`${value}`, '3-day trend'];
                  return [value, name];
                }}
              />
              <ReferenceLine yAxisId="score" y={75} stroke="#10B981" strokeDasharray="3 3" />
              <ReferenceLine yAxisId="score" y={50} stroke="#EF4444" strokeDasharray="3 3" />
              <Bar yAxisId="score" dataKey="avg" name="avg" radius={[5, 5, 0, 0]} maxBarSize={36}>
                {chartData.map((d) => (
                  <Cell
                    key={d.day}
                    fill={d.avg !== null ? (d.avg >= 75 ? '#10B981' : d.avg >= 50 ? '#F59E0B' : '#EF4444') : '#ccc'}
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
              <Bar yAxisId="dips" dataKey="dips" name="dips" fill="#EF4444" fillOpacity={0.3} radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Line
                yAxisId="score"
                type="monotone"
                dataKey="trend"
                name="trend"
                stroke="#007AFF"
                strokeWidth={2}
                dot={{ fill: '#007AFF', r: 3, strokeWidth: 0 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Mood distribution */}
      {moodData.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: 'var(--studio-text-muted)', margin: '16px 0 6px' }}>Journal mood breakdown</p>
          <ResponsiveContainer width="100%" height={80}>
            <ComposedChart data={moodData} layout="vertical" margin={{ left: 60, right: 40, top: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="mood" tick={{ fontSize: 11 }} width={58} />
              <Tooltip formatter={(v: number) => [`${v} entries`, 'Count']} contentStyle={{ fontSize: 13, borderRadius: 8 }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 11 }}>
                {moodData.map((d) => <Cell key={d.mood} fill={d.fill} />)}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      <ul className="weekly-insights__tips">
        {insights.map((tip) => (
          <li key={tip}><StudioIcon name="clara" size={16} /> {tip}</li>
        ))}
      </ul>
    </section>
  );
}

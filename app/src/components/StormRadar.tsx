import { useMemo, type CSSProperties } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { db, type AcseScore } from '../db/db';
import StudioIcon from './StudioIcon';

interface HourRisk {
  hour: number;
  label: string;
  risk: 'low' | 'medium' | 'high';
  score: number;
}

const RISK_COLOR: Record<HourRisk['risk'], string> = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
};

export default function StormRadar({ userId }: { userId?: number }) {
  const scores = useLiveQuery<AcseScore[]>(
    () => userId ? db.acseScores.where('userId').equals(userId).toArray() : Promise.resolve([] as AcseScore[]),
    [userId]
  );

  const hours = useMemo((): HourRisk[] => {
    const buckets = new Map<number, number[]>();
    for (const s of scores ?? []) {
      const h = new Date(s.timestamp).getHours();
      const arr = buckets.get(h) ?? [];
      arr.push(s.score);
      buckets.set(h, arr);
    }
    const cognitiveDipHours = [14, 15, 16, 20, 21];
    const result: HourRisk[] = [];
    for (let h = 6; h <= 22; h += 2) {
      const vals = buckets.get(h) ?? buckets.get(h - 1) ?? buckets.get(h + 1) ?? [];
      const avg = vals.length
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : cognitiveDipHours.includes(h) ? 58 : 82;
      result.push({
        hour: h,
        label: new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' }),
        risk: avg < 55 ? 'high' : avg < 72 ? 'medium' : 'low',
        score: Math.round(avg),
      });
    }
    return result;
  }, [scores]);

  const nowHour = new Date().getHours();
  const nextStorm = hours.find((h) => h.risk === 'high' && h.hour >= nowHour);
  const chartData = hours.map((h) => ({ ...h, isNow: h.hour === hours.reduce((prev, cur) => Math.abs(cur.hour - nowHour) < Math.abs(prev.hour - nowHour) ? cur : prev).hour }));

  return (
    <div className="card storm-radar">
      <div className="storm-radar__header">
        <StudioIcon name="score" size={22} />
        <div>
          <p className="storm-radar__eyebrow">Storm Radar™</p>
          <h3 className="storm-radar__title">Cognitive weather forecast</h3>
        </div>
      </div>

      {nextStorm && (
        <p className="storm-radar__alert">
          Elevated risk around <strong>{nextStorm.label}</strong> — consider a check-in or Memory Thread review.
        </p>
      )}

      {/* Chart view */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="radarAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#007AFF" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#007AFF" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--studio-border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} ticks={[0, 50, 72, 100]} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v: number, name: string) => [
              name === 'score' ? `${v} stability` : v,
              name === 'score' ? 'Est. ACSE' : name,
            ]}
          />
          <ReferenceLine y={72} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Moderate', position: 'insideTopRight', fontSize: 9, fill: '#F59E0B' }} />
          <ReferenceLine y={55} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'High risk', position: 'insideTopRight', fontSize: 9, fill: '#EF4444' }} />
          <Bar dataKey="score" name="score" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {chartData.map((d) => (
              <Cell key={d.hour} fill={RISK_COLOR[d.risk]} fillOpacity={d.isNow ? 1 : 0.65} />
            ))}
          </Bar>
          <Area type="monotone" dataKey="score" stroke="#007AFF" strokeWidth={1.5} fill="url(#radarAreaGrad)" dot={false} strokeDasharray="4 2" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Color-coded cell grid (compact) */}
      <div className="storm-radar__grid" role="list" aria-label="Hourly cognitive risk" style={{ marginTop: 10 }}>
        {hours.map((h) => (
          <div
            key={h.hour}
            role="listitem"
            className={`storm-radar__cell storm-radar__cell--${h.risk}`}
            title={`${h.label}: estimated stability ${h.score}`}
          >
            <span className="storm-radar__cell-label">{h.label}</span>
            <span className="storm-radar__cell-bar" style={{ '--fill': `${h.score}%` } as CSSProperties} />
          </div>
        ))}
      </div>

      <p className="storm-radar__footnote">
        Blends live ACSE history with circadian patterns common in dementia care.
      </p>
    </div>
  );
}

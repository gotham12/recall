import type { SleepLog } from '../db/db';

export interface SleepNightMetrics {
  date: string;
  durationHours: number;
  efficiency: number;
  quality: number;
  awakenings: number;
  fragmentationScore: number;
}

export interface SleepClinicalReport {
  nights: SleepNightMetrics[];
  avgDuration: number;
  avgEfficiency: number;
  avgQuality: number;
  avgAwakenings: number;
  trend: 'improving' | 'stable' | 'declining';
  riskLevel: 'low' | 'moderate' | 'elevated';
  interpretation: string[];
  recommendations: string[];
  neurologyNotes: string[];
}

function parseTime(iso: string): number {
  return new Date(iso).getTime();
}

export function nightMetrics(log: SleepLog): SleepNightMetrics {
  const bed = parseTime(log.bedTime);
  let wake = parseTime(log.wakeTime);
  if (wake <= bed) wake += 24 * 60 * 60 * 1000;

  const timeInBedH = (wake - bed) / (1000 * 60 * 60);
  const awakeMin = log.awakenings * 15;
  const sleepMin = Math.max(0, timeInBedH * 60 - awakeMin);
  const efficiency = timeInBedH > 0 ? Math.round((sleepMin / (timeInBedH * 60)) * 100) : 0;
  const fragmentationScore = Math.min(100, log.awakenings * 12 + (5 - log.quality) * 8);

  return {
    date: log.date,
    durationHours: Math.round(sleepMin / 6) / 10,
    efficiency,
    quality: log.quality,
    awakenings: log.awakenings,
    fragmentationScore,
  };
}

export function analyzeSleep(logs: SleepLog[]): SleepClinicalReport {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const nights = sorted.map(nightMetrics);

  if (nights.length === 0) {
    return {
      nights: [],
      avgDuration: 0,
      avgEfficiency: 0,
      avgQuality: 0,
      avgAwakenings: 0,
      trend: 'stable',
      riskLevel: 'moderate',
      interpretation: ['No sleep data logged yet. Tracking sleep helps monitor cognitive health.'],
      recommendations: ['Log bedtime and wake time each morning.', 'Aim for 7–8 hours in bed with a consistent schedule.'],
      neurologyNotes: [
        'During deep slow-wave sleep, the glymphatic system clears metabolic waste including amyloid-beta from the brain.',
        'Poor sleep efficiency and fragmentation are associated with faster cognitive decline in neurodegenerative conditions.',
      ],
    };
  }

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const avgDuration = avg(nights.map((n) => n.durationHours));
  const avgEfficiency = avg(nights.map((n) => n.efficiency));
  const avgQuality = avg(nights.map((n) => n.quality));
  const avgAwakenings = avg(nights.map((n) => n.awakenings));

  const recent = nights.slice(-3);
  const earlier = nights.slice(-6, -3);
  let trend: SleepClinicalReport['trend'] = 'stable';
  if (recent.length >= 2 && earlier.length >= 2) {
    const recentEff = avg(recent.map((n) => n.efficiency));
    const earlierEff = avg(earlier.map((n) => n.efficiency));
    if (recentEff - earlierEff > 5) trend = 'improving';
    else if (earlierEff - recentEff > 5) trend = 'declining';
  }

  let riskLevel: SleepClinicalReport['riskLevel'] = 'low';
  if (avgDuration < 6 || avgEfficiency < 75 || avgAwakenings > 2.5) riskLevel = 'elevated';
  else if (avgDuration < 7 || avgEfficiency < 85 || avgAwakenings > 1.5) riskLevel = 'moderate';

  const interpretation: string[] = [];
  if (avgDuration >= 7 && avgDuration <= 9) {
    interpretation.push(`Margaret is averaging ${avgDuration.toFixed(1)} hours of estimated sleep — within the recommended range for brain health.`);
  } else if (avgDuration < 7) {
    interpretation.push(`Sleep duration is averaging ${avgDuration.toFixed(1)} hours, below the 7–8 hour target linked to slower cognitive decline.`);
  } else {
    interpretation.push(`Sleep duration is ${avgDuration.toFixed(1)} hours on average — monitor for excessive time in bed without restorative sleep.`);
  }

  if (avgEfficiency >= 85) {
    interpretation.push(`Sleep efficiency (${Math.round(avgEfficiency)}%) is strong, suggesting consolidated rest and adequate deep-sleep opportunity.`);
  } else {
    interpretation.push(`Sleep efficiency (${Math.round(avgEfficiency)}%) is reduced — fragmented sleep limits slow-wave sleep when amyloid clearance is most active.`);
  }

  if (avgAwakenings > 2) {
    interpretation.push(`Frequent awakenings (${avgAwakenings.toFixed(1)}/night) increase sleep fragmentation, a modifiable risk factor for neurodegeneration progression.`);
  }

  if (trend === 'improving') interpretation.push('Recent nights show improving sleep metrics — a positive signal for cognitive resilience.');
  if (trend === 'declining') interpretation.push('Recent sleep quality is trending down — consider reviewing evening routine, lighting, and medication timing with the care team.');

  const recommendations: string[] = [
    'Keep a consistent bedtime within 30 minutes each night.',
    'Limit screen light 1 hour before bed; use warm, dim lighting on the porch routine.',
    'Log awakenings to distinguish bathroom trips from restless fragmentation.',
  ];
  if (avgDuration < 7) recommendations.push('Discuss afternoon rest vs. early bedtime with Susan to protect total sleep time.');
  if (avgEfficiency < 80) recommendations.push('Review evening caffeine, fluid intake, and Lisinopril timing with physician.');
  if (riskLevel === 'elevated') recommendations.push('Consider a sleep diary review with neurology at the next visit.');

  const neurologyNotes = [
    'Slow-wave sleep supports glymphatic clearance of amyloid-beta and tau — proteins implicated in Alzheimer\'s pathology.',
    'Sleep deprivation acutely raises cortisol and impairs hippocampal memory consolidation, compounding dementia symptoms.',
    'In MCI and mild dementia, treating sleep apnea and maintaining sleep hygiene can slow functional decline.',
    'Circadian disruption (common in aging) reduces melatonin amplitude — evening wind-down routines help entrain the clock.',
  ];

  return {
    nights,
    avgDuration,
    avgEfficiency,
    avgQuality,
    avgAwakenings,
    trend,
    riskLevel,
    interpretation,
    recommendations,
    neurologyNotes,
  };
}

export function formatSleepDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function qualityLabel(q: number): string {
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  return labels[q] ?? 'Unknown';
}

export function dateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function lastNightDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

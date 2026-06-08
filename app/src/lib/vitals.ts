export interface VitalReading {
  label: string;
  value: string;
  unit: string;
  status: 'normal' | 'watch' | 'alert';
  trend: 'stable' | 'up' | 'down';
  detail?: string;
  sparkline: number[];
}

export interface OrthostaticBP {
  position: 'Sitting' | 'Standing';
  systolic: number;
  diastolic: number;
  pulse: number;
  time: string;
}

export interface VitalsSnapshot {
  recordedAt: string;
  heartRate: VitalReading;
  respiratoryRate: VitalReading;
  weightBmi: VitalReading;
  bodyTemp: VitalReading;
  orthostatic: OrthostaticBP[];
  orthostaticNote: string;
}

function spark(base: number, variance: number, points = 12): number[] {
  return Array.from({ length: points }, (_, i) => {
    const wave = Math.sin(i * 0.9) * variance * 0.4;
    const drift = (i - points / 2) * (variance * 0.05);
    return Math.round(base + wave + drift);
  });
}

/** Realistic demo vitals for supervisor dashboard */
export function getPatientVitals(patientName = 'Margaret'): VitalsSnapshot {
  const now = new Date();
  const hr = 74 + Math.floor(Math.random() * 4);
  const rr = 16 + Math.floor(Math.random() * 2);
  const weight = 142;
  const heightIn = 64;
  const bmi = Math.round((weight / (heightIn * heightIn)) * 703 * 10) / 10;
  const temp = 98.2 + Math.random() * 0.4;

  const sittingSys = 128;
  const sittingDia = 78;
  const standingSys = 118;
  const standingDia = 72;

  return {
    recordedAt: now.toISOString(),
    heartRate: {
      label: 'Heart Rate',
      value: String(hr),
      unit: 'bpm',
      status: hr > 100 || hr < 55 ? 'watch' : 'normal',
      trend: 'stable',
      detail: 'Resting, regular rhythm',
      sparkline: spark(hr, 6),
    },
    respiratoryRate: {
      label: 'Respiratory Rate',
      value: String(rr),
      unit: '/min',
      status: rr > 20 ? 'watch' : 'normal',
      trend: 'stable',
      detail: 'Calm, unlabored breathing',
      sparkline: spark(rr, 2),
    },
    weightBmi: {
      label: 'Weight / BMI',
      value: `${weight} lb`,
      unit: `BMI ${bmi}`,
      status: bmi >= 25 ? 'watch' : 'normal',
      trend: 'down',
      detail: `${patientName} — stable over 30 days`,
      sparkline: spark(weight, 3),
    },
    bodyTemp: {
      label: 'Body Temperature',
      value: temp.toFixed(1),
      unit: '°F',
      status: temp >= 100.4 ? 'alert' : temp >= 99.5 ? 'watch' : 'normal',
      trend: 'stable',
      detail: 'Oral, morning reading',
      sparkline: spark(Math.round(temp * 10), 3).map((v) => v / 10),
    },
    orthostatic: [
      {
        position: 'Sitting',
        systolic: sittingSys,
        diastolic: sittingDia,
        pulse: hr,
        time: '8:15 AM',
      },
      {
        position: 'Standing',
        systolic: standingSys,
        diastolic: standingDia,
        pulse: hr + 8,
        time: '8:17 AM',
      },
    ],
    orthostaticNote:
      sittingSys - standingSys >= 20
        ? 'Mild orthostatic drop — monitor on standing'
        : 'Orthostatic response within expected range',
  };
}

export function statusColor(status: VitalReading['status']): string {
  if (status === 'alert') return 'var(--cheer-coral, #EF4444)';
  if (status === 'watch') return 'var(--cheer-sun, #F59E0B)';
  return 'var(--cheer-mint, #10B981)';
}

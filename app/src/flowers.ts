export const FLOWERS = {
  splash: '/flowers/flower-01-splash.webp',
  landing: '/flowers/flower-02-landing.webp',
  patient: '/flowers/flower-03-patient.webp',
  supervisor: '/flowers/flower-04-supervisor.webp',
  patientEnter: '/flowers/flower-05-patient-enter.webp',
  supervisorEnter: '/flowers/flower-06-supervisor-enter.webp',
  patientApp: '/flowers/flower-07-patient-app.webp',
  supervisorApp: '/flowers/flower-08-supervisor-app.webp',
  home: '/flowers/flower-09-home.webp',
  comfort: '/flowers/flower-10-comfort.webp',
} as const;

export type FlowerKey = keyof typeof FLOWERS;

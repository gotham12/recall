/** Public assets — always prefix with Vite base (e.g. /recall/ on GitHub Pages). */
const base = import.meta.env.BASE_URL;

export const LOGO_URL = `${base}logo.png`;
export const FORGET_ME_NOT_URL = `${base}forget-me-not.png`;

/** Login flow hero photos (bundled in public/login/) */
export const LOGIN_HERO = {
  welcome: `${base}login/welcome-family.jpg`,
  patientList: `${base}login/patient-journey.jpg`,
  patientPin: `${base}login/patient-steps.jpg`,
  supervisorList: `${base}login/supervisor-care.jpg`,
  supervisorAuth: `${base}login/supervisor-together.jpg`,
  margaretProfile: `${base}login/margaret-profile.jpg`,
} as const;

/** Familiar-face profile photos (remote — used in app, not login heroes) */
export const FAMILY_PHOTOS = {
  susan: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop&crop=faces&auto=format&q=80',
  robert: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=240&h=240&fit=crop&crop=faces&auto=format&q=80',
  lily: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=240&h=240&fit=crop&crop=faces&auto=format&q=80',
} as const;

/** Safety circle contacts — curated portrait photos */
export const CONTACT_PHOTOS = {
  drChen: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=240&h=240&fit=crop&crop=faces',
  neighborTom: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=240&h=240&fit=crop&crop=faces',
} as const;

export const TYLENOL_REFERENCE_URL = `${base}photos/tylenol-reference.png`;

export function familyPhotoUrl(name: string): string | undefined {
  const key = name.trim().toLowerCase() as keyof typeof FAMILY_PHOTOS;
  return FAMILY_PHOTOS[key];
}

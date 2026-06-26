/** Public assets — always prefix with Vite base (e.g. /recall/ on GitHub Pages). */
const base = import.meta.env.BASE_URL;

export const LOGO_URL = `${base}logo.png`;
export const FORGET_ME_NOT_URL = `${base}forget-me-not.png`;

export const FAMILY_PHOTOS = {
  susan: `${base}photos/susan.png?v=2`,
  robert: `${base}photos/robert.png?v=2`,
  lily: `${base}photos/lily.png?v=2`,
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

/** Public assets — always prefix with Vite base (e.g. /recall/ on GitHub Pages). */
const base = import.meta.env.BASE_URL;

export const LOGO_URL = `${base}logo.png`;
export const FORGET_ME_NOT_URL = `${base}forget-me-not.png`;

export const FAMILY_PHOTOS = {
  susan: `${base}photos/susan.png?v=2`,
  robert: `${base}photos/robert.png?v=2`,
  lily: `${base}photos/lily.png?v=2`,
} as const;

export const TYLENOL_REFERENCE_URL = `${base}photos/tylenol-reference.png`;

export function familyPhotoUrl(name: string): string | undefined {
  const key = name.trim().toLowerCase() as keyof typeof FAMILY_PHOTOS;
  return FAMILY_PHOTOS[key];
}

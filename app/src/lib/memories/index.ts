/** Bundled Margaret family memory photos — local assets for reliable offline loading */
const base = import.meta.env.BASE_URL;

export const MARGARET_FAMILY_PHOTOS = {
  garden: `${base}photos/garden.jpg`,
  dinner: `${base}photos/dinner.jpg`,
  birthday: `${base}photos/birthday.jpg`,
  porch: `${base}photos/porch.jpg`,
  picnic: `${base}photos/picnic.jpg`,
} as const;

export type MemoryPhotoKey = keyof typeof MARGARET_FAMILY_PHOTOS;

export function memoryPhotoUrl(key: MemoryPhotoKey): string {
  return MARGARET_FAMILY_PHOTOS[key];
}

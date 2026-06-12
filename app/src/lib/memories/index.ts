const BASE = 'https://images.unsplash.com/photo';

export const MARGARET_FAMILY_PHOTOS = {
  garden:   `${BASE}-1508193638397-1cc4ff75d601?w=800&h=600&fit=crop&auto=format&q=80`,
  dinner:   `${BASE}-1414235077428-338989a2e8c0?w=800&h=600&fit=crop&auto=format&q=80`,
  birthday: `${BASE}-1558618666-fcd25c85cd64?w=800&h=600&fit=crop&auto=format&q=80`,
  porch:    `${BASE}-1449824913935-59a10b8d2000?w=800&h=600&fit=crop&auto=format&q=80`,
  picnic:   `${BASE}-1529543544282-ea669407fca3?w=800&h=600&fit=crop&auto=format&q=80`,
} as const;

export type MemoryPhotoKey = keyof typeof MARGARET_FAMILY_PHOTOS;

export function memoryPhotoUrl(key: MemoryPhotoKey): string {
  return MARGARET_FAMILY_PHOTOS[key];
}

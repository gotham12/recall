import { MEMORY_GARDEN } from './garden';
import { MEMORY_DINNER } from './dinner';
import { MEMORY_BIRTHDAY } from './birthday';
import { MEMORY_PORCH } from './porch';
import { MEMORY_PICNIC } from './picnic';

export const MARGARET_FAMILY_PHOTOS = {
  garden: MEMORY_GARDEN,
  dinner: MEMORY_DINNER,
  birthday: MEMORY_BIRTHDAY,
  porch: MEMORY_PORCH,
  picnic: MEMORY_PICNIC,
} as const;

export type MemoryPhotoKey = keyof typeof MARGARET_FAMILY_PHOTOS;

export function memoryPhotoUrl(key: MemoryPhotoKey): string {
  return MARGARET_FAMILY_PHOTOS[key];
}

import { FAMILY_PHOTOS, CONTACT_PHOTOS } from './assets';

export interface SafetyContactView {
  name: string;
  relationship: string;
  phone: string;
  primary?: boolean;
  photoUrl?: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

const FAMILY_PHOTO_BY_NAME: Record<string, string> = {
  susan: FAMILY_PHOTOS.susan,
  robert: FAMILY_PHOTOS.robert,
  lily: FAMILY_PHOTOS.lily,
  'dr. chen': CONTACT_PHOTOS.drChen,
  'neighbor tom': CONTACT_PHOTOS.neighborTom,
};

export function photoForContact(name: string): string | undefined {
  return FAMILY_PHOTO_BY_NAME[name.trim().toLowerCase()];
}

export function buildSafetyContacts(
  caregiver: { name: string; relationship: string; phone: string } | null,
  emergency: Array<{ name: string; relationship: string; phone: string; isPrimary?: boolean }>
): SafetyContactView[] {
  const list: SafetyContactView[] = [];

  if (caregiver?.phone) {
    list.push({
      name: caregiver.name,
      relationship: caregiver.relationship,
      phone: caregiver.phone,
      primary: true,
      photoUrl: photoForContact(caregiver.name),
    });
  }

  const caregiverPhone = caregiver ? normalizePhone(caregiver.phone) : '';
  const caregiverName = caregiver?.name.trim().toLowerCase() ?? '';

  for (const contact of emergency) {
    const phone = normalizePhone(contact.phone);
    const name = contact.name.trim().toLowerCase();
    const duplicatesCaregiver =
      (caregiverPhone && phone === caregiverPhone) ||
      (caregiverName && name === caregiverName);
    if (duplicatesCaregiver) continue;

    list.push({
      name: contact.name,
      relationship: contact.relationship,
      phone: contact.phone,
      primary: contact.isPrimary,
      photoUrl: photoForContact(contact.name),
    });
  }

  const susanSlots = list.filter((c) => c.name.trim().toLowerCase() === 'susan');
  if (susanSlots.length > 1) {
    const replaceIdx = list.findIndex(
      (c, i) => i > 0 && c.name.trim().toLowerCase() === 'susan'
    );
    if (replaceIdx >= 0) {
      list[replaceIdx] = {
        name: 'Robert',
        relationship: 'Grandson',
        phone: '+15555550187',
        primary: false,
        photoUrl: FAMILY_PHOTOS.robert,
      };
    }
  }

  const hasRobert = list.some((c) => c.name.trim().toLowerCase() === 'robert');
  if (!hasRobert && caregiverName === 'susan') {
    list.splice(1, 0, {
      name: 'Robert',
      relationship: 'Grandson',
      phone: '+15555550187',
      primary: false,
      photoUrl: FAMILY_PHOTOS.robert,
    });
  }

  const seen = new Set<string>();
  return list.filter((c) => {
    const key = `${normalizePhone(c.phone)}|${c.name.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

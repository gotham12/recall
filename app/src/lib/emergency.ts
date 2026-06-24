import { db, type EmergencyContact, type User } from '../db/db';
import { useAppStore } from '../store/appStore';

export async function triggerSOS(user: User): Promise<void> {
  const { addSupervisorAlert } = useAppStore.getState();
  const now = new Date().toISOString();

  addSupervisorAlert({
    message: `SOS activated by ${user.name} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    timestamp: now,
    type: 'sos',
    persist: true,
  });

  if (user.id) {
    await db.events.add({
      userId: user.id,
      timestamp: now,
      type: 'system_alert',
      title: 'Emergency SOS activated',
      description: `${user.name} pressed the emergency button. Caregiver notified.`,
      completed: true,
      source: 'system',
    });

    await db.supervisorAlerts.add({
      userId: user.id,
      message: `SOS — ${user.name} needs help now`,
      timestamp: now,
      type: 'sos',
      dismissed: false,
    });
  }
}

export async function shareLocation(user: User): Promise<string | null> {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const maps = `https://maps.google.com/?q=${latitude},${longitude}`;
        resolve(maps);
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

export function buildEmergencySms(user: User, contacts: EmergencyContact[], locationUrl?: string | null): string {
  const lines = [
    `Recall SOS from ${user.name}.`,
    user.homeAddress ? `Home: ${user.homeAddress}` : `City: ${user.city}`,
    locationUrl ? `Location: ${locationUrl}` : '',
    user.emergencyNote ? `Note: ${user.emergencyNote}` : '',
    'Please call or visit immediately.',
  ].filter(Boolean);
  return lines.join(' ');
}

export function dialNumber(phone: string): void {
  window.open(`tel:${phone.replace(/\s/g, '')}`, '_self');
}

export function dial911(): void {
  window.open('tel:911', '_self');
}

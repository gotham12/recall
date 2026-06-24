import { useLiveQuery } from 'dexie-react-hooks';
import { db, type EmergencyContact } from '../db/db';
import { useAppStore } from '../store/appStore';
import { dialNumber } from '../lib/emergency';
import { buildSafetyContacts } from '../lib/safetyContacts';
import StudioIcon from './StudioIcon';

export default function SafetyCircle() {
  const { user } = useAppStore();

  const contacts = useLiveQuery<EmergencyContact[]>(
    () => (user?.id ? db.emergencyContacts.where('userId').equals(user.id).toArray() : []),
    [user?.id]
  ) ?? [];

  if (!user) return null;

  const caregiver = user.caregiverPhone
    ? {
        name: user.caregiverName,
        relationship: user.caregiverRelationship,
        phone: user.caregiverPhone,
      }
    : null;

  const allContacts = buildSafetyContacts(caregiver, contacts);

  if (allContacts.length === 0) return (
    <section className="safety-circle card">
      <div className="safety-circle__header">
        <StudioIcon name="shield" size={22} />
        <h3 className="studio-section-title" style={{ margin: 0 }}>Your safety circle</h3>
      </div>
      <p style={{ padding: '16px', color: 'rgba(0,0,0,0.45)', fontSize: 15, textAlign: 'center' }}>
        No contacts added yet. Ask your caregiver to set up your safety circle.
      </p>
    </section>
  );

  return (
    <section className="safety-circle card">
      <div className="safety-circle__header">
        <StudioIcon name="shield" size={22} />
        <h3 className="studio-section-title" style={{ margin: 0 }}>Your safety circle</h3>
      </div>
      <div className="safety-circle__grid">
        {allContacts.map((c) => (
          <button
            key={`${c.phone}-${c.name}`}
            type="button"
            className="safety-contact tap-feedback"
            onClick={() => dialNumber(c.phone)}
          >
            <span className="safety-contact__avatar">
              {c.photoUrl ? (
                <img src={c.photoUrl} alt="" className="safety-contact__photo" />
              ) : (
                c.name.charAt(0)
              )}
            </span>
            <span className="safety-contact__name">{c.name}</span>
            <span className="safety-contact__rel">{c.relationship}</span>
            <span className="safety-contact__call">Tap to call</span>
          </button>
        ))}
      </div>
    </section>
  );
}

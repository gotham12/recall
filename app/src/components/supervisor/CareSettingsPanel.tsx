import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  DEFAULT_CARE_SETTINGS,
  loadCareSettings,
  saveCareSettings,
  type CareSettings,
} from '../../lib/careSettings';
import StudioIcon from '../StudioIcon';

export default function CareSettingsPanel() {
  const { user } = useAppStore();
  const [settings, setSettings] = useState<CareSettings>(() => loadCareSettings(user?.id));
  const [saved, setSaved] = useState(false);

  if (!user?.id) return null;

  const update = <K extends keyof CareSettings>(key: K, value: CareSettings[K]) => {
    setSettings((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveCareSettings(user.id!, settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_CARE_SETTINGS, patientDisplayName: user.name });
    setSaved(false);
  };

  return (
    <section className="care-settings card">
      <div className="care-settings__header">
        <StudioIcon name="settings" size={22} />
        <h3 className="studio-section-title" style={{ margin: 0 }}>Care Customization™</h3>
      </div>

      <div className="care-settings__grid">
        <label className="care-settings__field">
          <span>Comfort Mode threshold</span>
          <input
            type="range"
            min={30}
            max={70}
            value={settings.comfortThreshold}
            onChange={(e) => update('comfortThreshold', Number(e.target.value))}
          />
          <em>{settings.comfortThreshold}</em>
        </label>

        <label className="care-settings__field">
          <span>Alert when score below</span>
          <input
            type="range"
            min={40}
            max={80}
            value={settings.alertOnScoreBelow}
            onChange={(e) => update('alertOnScoreBelow', Number(e.target.value))}
          />
          <em>{settings.alertOnScoreBelow}</em>
        </label>

        <label className="care-settings__field">
          <span>Inactivity alert (minutes)</span>
          <input
            type="number"
            min={10}
            max={60}
            value={settings.inactivityMinutes}
            onChange={(e) => update('inactivityMinutes', Number(e.target.value) || 20)}
            className="studio-input"
          />
        </label>

        <label className="care-settings__field">
          <span>Daily check-in hour</span>
          <input
            type="number"
            min={6}
            max={12}
            value={settings.dailyCheckInHour}
            onChange={(e) => update('dailyCheckInHour', Number(e.target.value) || 9)}
            className="studio-input"
          />
        </label>

        <label className="care-settings__field care-settings__field--full">
          <span>Patient display name</span>
          <input
            type="text"
            value={settings.patientDisplayName}
            onChange={(e) => update('patientDisplayName', e.target.value)}
            placeholder={user.name}
            className="studio-input"
          />
        </label>
      </div>

      <div className="care-settings__toggles">
        {(
          [
            ['enableSundowningBoost', 'Sundowning sensitivity (4–8 PM)'],
            ['enablePerseverationDetection', 'Perseveration & semantic loops'],
            ['enableNavigationTracking', 'Erratic navigation tracking'],
            ['enableMissedMedAlerts', 'Missed medication windows'],
            ['recoveryEnabled', 'Engagement recovery (+3 per 5 min calm)'],
            ['notifyOnComfortMode', 'Notify on Comfort Mode'],
            ['notifyOnSOS', 'Notify on SOS'],
            ['notifyOnMissedMeds', 'Notify on missed meds'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="care-settings__toggle">
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => update(key, e.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="care-settings__actions">
        <button type="button" className="studio-btn studio-btn--primary tap-feedback" onClick={handleSave}>
          {saved ? 'Saved ✓' : 'Save settings'}
        </button>
        <button type="button" className="studio-btn tap-feedback" onClick={handleReset}>
          Reset defaults
        </button>
      </div>
    </section>
  );
}

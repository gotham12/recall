import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { type FontScale } from '../lib/settings';
import { requestNotificationPermission } from '../lib/notifications';
import { useSettings } from '../hooks/useSettings';
import StudioIcon from './StudioIcon';

interface Props {
  open: boolean;
  onClose: () => void;
}

function SettingsSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="settings-toggle">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`settings-switch ${checked ? 'settings-switch--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="settings-switch__thumb" />
      </button>
    </label>
  );
}

export default function SettingsSheet({ open, onClose }: Props) {
  const { toggleTheme, theme } = useAppStore();
  const { settings, update, refresh } = useSettings();
  const [notifStatus, setNotifStatus] = useState<'unsupported' | 'granted' | 'denied' | 'default'>('default');

  useEffect(() => {
    if (!open) return;
    refresh();
    if (!('Notification' in window)) {
      setNotifStatus('unsupported');
    } else {
      setNotifStatus(Notification.permission as 'granted' | 'denied' | 'default');
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleMedReminders = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      setNotifStatus(
        !('Notification' in window) ? 'unsupported' : Notification.permission as 'granted' | 'denied' | 'default'
      );
      update({ medReminders: granted || Notification.permission !== 'denied' });
      return;
    }
    update({ medReminders: false });
  };

  return (
    <div className="settings-overlay" onClick={onClose} role="presentation">
      <div
        className="settings-sheet card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
      >
        <div className="settings-sheet__header">
          <h2 className="settings-sheet__title">Settings</h2>
          <button type="button" className="studio-icon-btn tap-feedback" onClick={onClose} aria-label="Close">
            <StudioIcon name="close" size={20} />
          </button>
        </div>

        <div className="settings-group">
          <p className="settings-group__label">Accessibility</p>
          <SettingsSwitch
            label="Easy Mode — larger buttons & simpler layout"
            checked={settings.easyMode}
            onChange={(easyMode) => update({ easyMode })}
          />
          <SettingsSwitch
            label="High contrast"
            checked={settings.highContrast}
            onChange={(highContrast) => update({ highContrast })}
          />
          <div className="settings-field">
            <span>Text size</span>
            <select
              className="studio-select"
              value={settings.fontScale}
              onChange={(e) => update({ fontScale: e.target.value as FontScale })}
            >
              <option value="normal">Normal</option>
              <option value="large">Large</option>
              <option value="xlarge">Extra large</option>
            </select>
          </div>
        </div>

        <div className="settings-group">
          <p className="settings-group__label">Reminders</p>
          <SettingsSwitch
            label="Medication reminders"
            checked={settings.medReminders}
            onChange={(enabled) => void handleMedReminders(enabled)}
          />
          {notifStatus === 'denied' && (
            <p className="settings-hint settings-hint--warn">
              Notifications are blocked. Enable them in your device Settings to get med reminders.
            </p>
          )}
          {notifStatus === 'unsupported' && (
            <p className="settings-hint">This browser does not support notifications.</p>
          )}
        </div>

        <div className="settings-group">
          <p className="settings-group__label">Appearance</p>
          <button type="button" className="studio-btn tap-feedback" style={{ width: '100%' }} onClick={toggleTheme}>
            <StudioIcon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </button>
        </div>

        <p className="settings-footnote">
          Recall v1.0 · Not a medical device · Data stored on this device
        </p>
      </div>
    </div>
  );
}

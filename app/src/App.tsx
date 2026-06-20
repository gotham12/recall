import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { seedIfEmpty } from './db/seed';
import { useMedReminders } from './hooks/useMedReminders';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useSyncBridge } from './hooks/useSyncBridge';
import LoadingScreen from './components/LoadingScreen';
import LoginScreen from './components/LoginScreen';
import PatientView from './views/PatientView';
import ProView from './views/ProView';
import SupervisorView from './views/SupervisorView';
import ComfortMode from './views/ComfortMode';
import MedicalDisclaimer from './components/MedicalDisclaimer';
import OfflineBanner from './components/OfflineBanner';

export default function App() {
  const { screen, comfortModeActive, isPro } = useAppStore();
  const [showConsent, setShowConsent] = useState(true);
  const online = useOnlineStatus();

  useMedReminders();
  useSyncBridge();

  useEffect(() => {
    seedIfEmpty().catch(console.error);
  }, []);

  if (showConsent) {
    return <MedicalDisclaimer onAccept={() => setShowConsent(false)} />;
  }

  return (
    <>
      {!online && <OfflineBanner />}
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'login' && <LoginScreen />}
      {screen === 'patient' && (
        <>
          {isPro ? <ProView /> : <PatientView />}
          {comfortModeActive && <ComfortMode />}
        </>
      )}
      {screen === 'supervisor' && <SupervisorView />}
    </>
  );
}

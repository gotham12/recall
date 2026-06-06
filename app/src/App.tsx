import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { seedIfEmpty } from './db/seed';
import OpeningFlow from './components/OpeningFlow';
import PatientView from './views/PatientView';
import SupervisorView from './views/SupervisorView';
import ComfortMode from './views/ComfortMode';

export default function App() {
  const { screen, comfortModeActive } = useAppStore();

  useEffect(() => {
    seedIfEmpty().catch(console.error);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
  }, []);

  return (
    <>
      {screen === 'opening'    && <OpeningFlow />}
      {screen === 'patient'    && <PatientView />}
      {screen === 'supervisor' && <SupervisorView />}
      {comfortModeActive       && <ComfortMode />}
    </>
  );
}

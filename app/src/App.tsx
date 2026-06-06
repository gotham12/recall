import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { seedIfEmpty } from './db/seed';
import LoadingScreen from './components/LoadingScreen';
import LoginScreen from './components/LoginScreen';
import PatientView from './views/PatientView';
import SupervisorView from './views/SupervisorView';
import ComfortMode from './views/ComfortMode';

export default function App() {
  const { screen, setScreen, comfortModeActive } = useAppStore();

  useEffect(() => {
    seedIfEmpty().catch(console.error);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <>
      {screen === 'loading'    && <LoadingScreen onDone={() => setScreen('login')} />}
      {screen === 'login'      && <LoginScreen />}
      {screen === 'patient'    && <PatientView />}
      {screen === 'supervisor' && <SupervisorView />}
      {comfortModeActive       && <ComfortMode />}
    </>
  );
}

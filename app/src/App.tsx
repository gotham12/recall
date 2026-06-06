import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import { seedIfEmpty } from './db/seed';
import LoadingScreen from './components/LoadingScreen';
import LoginScreen from './components/LoginScreen';
import PatientView from './views/PatientView';
import SupervisorView from './views/SupervisorView';
import ComfortMode from './views/ComfortMode';

export default function App() {
  const { screen, comfortModeActive } = useAppStore();

  // Seed the database on first launch
  useEffect(() => {
    seedIfEmpty().catch(console.error);
  }, []);

  return (
    <>
      {screen === 'loading' && <LoadingScreen />}
      {screen === 'login' && <LoginScreen />}
      {screen === 'patient' && (
        <>
          <PatientView />
          {comfortModeActive && <ComfortMode />}
        </>
      )}
      {screen === 'supervisor' && <SupervisorView />}
    </>
  );
}

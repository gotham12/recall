import { db } from '../db/db';
import { useAppStore } from '../store/appStore';

export type DemoStepId =
  | 'intro'
  | 'orient'
  | 'clara'
  | 'repeat'
  | 'cascade'
  | 'comfort'
  | 'caregiver'
  | 'warmth'
  | 'resolve';

export interface DemoStep {
  id: DemoStepId;
  title: string;
  caption: string;
  durationMs: number;
}

export const GOLDEN_PATH_STEPS: DemoStep[] = [
  {
    id: 'intro',
    title: '4:47 PM — Shrewsbury',
    caption: 'Margaret, 78, begins to feel lost as daylight fades. Recall is listening.',
    durationMs: 4000,
  },
  {
    id: 'orient',
    title: 'State Reconstruction',
    caption: 'AI rebuilds her reality: where she is, what she did, what comes next.',
    durationMs: 3500,
  },
  {
    id: 'clara',
    title: 'Clara hears confusion',
    caption: 'She asks the same question twice — a signal of disorientation.',
    durationMs: 3500,
  },
  {
    id: 'repeat',
    title: 'ACSE drops',
    caption: 'Recall\'s Cognitive Stability Engine detects the repeat within 5 minutes.',
    durationMs: 3000,
  },
  {
    id: 'cascade',
    title: 'The Recall Cascade™',
    caption: 'Signal → Score → Intervention → Caregiver alert. Automatically.',
    durationMs: 4000,
  },
  {
    id: 'comfort',
    title: 'Comfort Mode',
    caption: 'Grounding voice, breathing, and narrative — before crisis.',
    durationMs: 5000,
  },
  {
    id: 'caregiver',
    title: 'Susan\'s phone lights up',
    caption: 'Storm Radar spikes. Alert: Comfort Mode activated.',
    durationMs: 4000,
  },
  {
    id: 'warmth',
    title: 'Presence Bridge',
    caption: 'One tap — Margaret feels Susan thinking of her.',
    durationMs: 3500,
  },
  {
    id: 'resolve',
    title: 'Crisis prevented',
    caption: 'Early detection. Automatic de-escalation. Family stays connected.',
    durationMs: 4000,
  },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function executeGoldenPathAction(
  stepId: DemoStepId,
  onNavigate?: (tab: 'home' | 'voice') => void
): Promise<void> {
  const store = useAppStore.getState();
  const user = store.user;

  switch (stepId) {
    case 'clara':
      onNavigate?.('voice');
      break;
    case 'repeat': {
      if (user?.id) {
        await db.events.add({
          userId: user.id,
          timestamp: new Date().toISOString(),
          type: 'user_action',
          title: 'Asked Clara: "What did I do today?"',
          description: 'Repeated question detected — possible disorientation.',
          completed: true,
          source: 'system',
        });
      }
      store.deductAcse(30, 'Same question asked twice within 5 minutes');
      store.deductAcse(25, 'Cognitive drift — sundowning pattern');
      break;
    }
    case 'comfort':
      if (!store.comfortModeActive && store.acseScore >= 50) {
        store.deductAcse(store.acseScore - 45, 'Demo — Comfort Mode');
      }
      break;
    case 'resolve':
      if (store.comfortModeActive) {
        await wait(500);
      }
      break;
    default:
      break;
  }
}

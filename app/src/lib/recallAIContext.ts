import type { User } from '../db/db';
import { buildClaraRichContext, formatClaraContextBlock, type ClaraRichContext } from './claraContext';
import {
  formatBriefingContext,
  gatherSupervisorBriefingSnapshot,
  type SupervisorBriefingSnapshot,
} from './supervisorBriefing';

export interface RecallAIContextBundle {
  snapshot: SupervisorBriefingSnapshot;
  contextBlock: string;
  patientFirstName: string;
  caregiverName: string;
}

/** Full grounded context for Recall AI caregiver chat. */
export async function buildRecallAIContext(
  user: User,
  acseScore: number,
  comfortModeActive: boolean
): Promise<RecallAIContextBundle> {
  const claraCtx = await buildClaraRichContext(user, acseScore, comfortModeActive);
  const snapshot = await gatherSupervisorBriefingSnapshot(user, acseScore, comfortModeActive, claraCtx);
  const claraBlock = formatClaraContextBlock(claraCtx);

  const contextBlock = `[LIVE PATIENT DATA — ${snapshot.patientName}]
${claraBlock}

Since last check-in (${snapshot.lastCheckInLabel}):
- ACSE: ${snapshot.acseScore}${snapshot.previousAcseScore != null ? ` (was ${snapshot.previousAcseScore})` : ''}; Comfort Mode: ${snapshot.comfortModeActive ? 'active' : 'off'}
- Alerts: ${snapshot.alertsSinceCheckIn.join('; ') || 'none'}
- Clara conversations: ${snapshot.claraConversations.join('; ') || 'none'}
- Events since check-in: ${snapshot.eventsSinceCheckIn.map((e) => e.title).join(', ') || 'none'}

Use ONLY the facts above when discussing ${snapshot.patientName}. If something is not listed, say you don't have that information in Recall yet.`;

  return {
    snapshot,
    contextBlock,
    patientFirstName: user.name.split(' ')[0],
    caregiverName: user.caregiverName,
  };
}

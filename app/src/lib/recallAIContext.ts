import type { User } from '../db/db';
import { buildClaraRichContext, formatClaraContextBlock } from './claraContext';
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
  const snapshot = await gatherSupervisorBriefingSnapshot(user, acseScore, comfortModeActive);
  const claraCtx = await buildClaraRichContext(user, acseScore, comfortModeActive);
  const briefingBlock = formatBriefingContext(snapshot);
  const claraBlock = formatClaraContextBlock(claraCtx);

  const contextBlock = `[CAREGIVER BRIEFING DATA]
${briefingBlock}

[PATIENT LIVE STATE — same data ${snapshot.patientName}'s companion Clara sees]
${claraBlock}

Use ONLY the facts above when discussing ${snapshot.patientName}. This is the complete patient-interface mirror — medications, routines, people, safety circle, vitals, events, and Clara activity. If something is not listed, say you don't have that information in Recall yet.`;

  return {
    snapshot,
    contextBlock,
    patientFirstName: user.name.split(' ')[0],
    caregiverName: user.caregiverName,
  };
}

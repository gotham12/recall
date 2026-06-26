import type { SupervisorBriefingSnapshot } from './supervisorBriefing';

const LOWER = (s: string) => s.toLowerCase();

export function localRecallAIReply(
  question: string,
  snapshot: SupervisorBriefingSnapshot,
  caregiverName: string
): string {
  const q = LOWER(question);
  const p = snapshot.patientName.split(' ')[0];

  if (/acse|score|cognitive|stability/.test(q)) {
    if (snapshot.acseScore >= 75) {
      return `${p}'s ACSE score is ${snapshot.acseScore}, which suggests stable cognition today. Keep encouraging routine and hydration. Always confirm changes with Dr. Chen.`;
    }
    if (snapshot.acseScore >= snapshot.comfortThreshold) {
      return `${p}'s ACSE is ${snapshot.acseScore} — in the watch zone. ${snapshot.acseSignalsSinceCheckIn.length ? `Recent signals: ${snapshot.acseSignalsSinceCheckIn.slice(0, 2).join('; ')}.` : 'Monitor for repeat questions or sundowning.'} Comfort Mode activates below ${snapshot.comfortThreshold}.`;
    }
    return `${p}'s ACSE is ${snapshot.acseScore}, below the ${snapshot.comfortThreshold} comfort threshold. ${snapshot.comfortModeActive ? 'Comfort Mode is active now.' : 'Consider activating Comfort Mode and checking in gently.'} Discuss persistent drops with her physician.`;
  }

  if (/med|pill|donepezil|memantine|levodopa|tylenol|dose/.test(q)) {
    const taken = snapshot.medsTakenToday.length ? snapshot.medsTakenToday.join(', ') : 'none confirmed yet';
    const pending = snapshot.medsPending.length ? snapshot.medsPending.join(', ') : 'none';
    const due = snapshot.dueMedsNow.length ? ` Due now: ${snapshot.dueMedsNow.join(', ')}.` : '';
    const unverified = snapshot.medsUnconfirmed.length
      ? ` Unverified attempts: ${snapshot.medsUnconfirmed.join(', ')}.`
      : '';
    return `Today ${p} has confirmed: ${taken}. Still pending: ${pending}.${due}${unverified} Never change doses without her doctor — I can help you track adherence and timing questions.`;
  }

  if (/sundown|evening|afternoon|confus/.test(q)) {
    return `Sundowning often peaks 4–8 PM. ${p}'s ACSE is ${snapshot.acseScore}. Try warm lighting, familiar music, and a simple evening routine. Clara can ground her with location and time cues. If confusion escalates, Comfort Mode may help before calling the clinic.`;
  }

  if (/comfort mode/.test(q)) {
    return snapshot.comfortModeActive
      ? `${p} is in Comfort Mode now — grounding, breathing, and nature visuals with Tibetan bells. Let her finish the flow; a gentle check-in after works well.`
      : `Comfort Mode opens when ACSE drops below ${snapshot.comfortThreshold} or when Clara detects disorientation. You can also activate it remotely from Overview.`;
  }

  if (/checkup|appointment|doctor|dr\.?\s*chen/.test(q)) {
    return snapshot.nextCheckup
      ? `Next visit: ${snapshot.nextCheckup}. Bring today's med list and any ACSE notes. ${caregiverName}, jot down repeat questions ${p} asked Clara this week.`
      : `No upcoming checkup is on ${p}'s Recall schedule. Add one under Schedule → Alerts & Events so Clara and I can reference it.`;
  }

  if (/clara|voice|talk/.test(q)) {
    return snapshot.claraConversations.length
      ? `${p} spoke with Clara ${snapshot.claraConversations.length} time(s) since your last check-in. Latest: ${snapshot.claraConversations[0].slice(0, 140)}.`
      : `No Clara voice conversations logged since your last check-in. Encourage ${p} to use the Voice tab if she seems disoriented.`;
  }

  if (/sleep/.test(q)) {
    return snapshot.lastSleep
      ? `Last night ${p} slept ${snapshot.lastSleep}. Poor sleep can worsen confusion — keep wake times consistent and limit late caffeine.`
      : `Sleep data isn't in Recall yet for ${p}. Apple Watch sync may populate this on the patient Health tab.`;
  }

  return `${caregiverName}, I'm Recall AI — your care advisor for ${p}. I have live data on meds, ACSE (${snapshot.acseScore}), routines, and today's events. Ask me about treatment options, sundowning, medications, or what to discuss at the next visit. I support your decisions but don't replace her medical team.`;
}

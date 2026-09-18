import { applyProposal } from './reducer';
import { seedWorld, OPENING } from './seed';
import { publicChanges } from './view';
import { type World, type Proposal, type PublicTurn, type Operation } from './types';
export { OPENING };
export const suggestions = ['Ask the woman what happened', 'Examine the bell tower', 'Wait until dusk'] as const;
export type SampleChoice = typeof suggestions[number];
export function demoTurn(world: World, input: string, id: string): { world: World; turn?: PublicTurn; clarification?: string } {
  // Sample choices are authored scenes, not interpretations of free-form player intent.
  if (!suggestions.some(choice => choice === input)) {
    return { world, clarification: 'This scripted sample only supports the displayed choices. Your action has not changed the story. Open Adventures and start a live adventure to use your own words. No login is needed.' };
  }
  const operations: Operation[] = [];
  const has = (id: string) => world.facts.some(f => f.id === id);
  const add = (id: string, text: string, subjects: string[], at = world.minute + 5) => operations.push({ op: 'establish_fact', fact: { id, key: `sample.${id}`, text, subjects, at, knownBy: ['player'] } });
  let narration = '', elapsed = 5, interpretation = '';
  if (input === 'Wait until dusk') {
    const dusk = world.scheduled.find(e => e.id === 'dusk')!;
    if (dusk.resolved) return { world, clarification: 'The sample has reached dusk. Try speaking to the woman or examining the tower.' };
    elapsed = Math.max(0, dusk.dueAt - world.minute);
    add('shelter', 'At dusk, the woman takes shelter inside the bell tower.', ['mara','tower'], dusk.dueAt);
    operations.push({ op: 'update_entity', id: 'mara', field: 'locationId', value: 'tower' });
    operations.push({ op: 'resolve_event', id: 'dusk', factId: 'shelter' });
    interpretation = 'You wait in Ashford until dusk.';
    narration = 'The light drains from the archway. At last the woman closes her hand around the lantern’s handle and crosses to the bell tower.\n\nYou watch her disappear into its shelter. Ashford is quiet around you. The ruins have kept their silence all day; now the last of the daylight goes with her.';
  } else if (input === 'Ask the woman what happened') {
    if (has('mara_name')) return { world, clarification: 'In this short sample, she has told you what she knows. Try examining the bell tower or waiting until dusk.' };
    add('mara_name', 'The woman at the arch introduces herself as Mara.', ['mara']);
    operations.push({ op: 'add_claim', claim: { id: 'mara_testimony', speakerId: 'mara', text: 'I heard a bell beneath the ground before the town fell.', knownBy: ['player'] } });
    interpretation = 'You ask the woman what happened to Ashford.';
    narration = '“My name is Mara,” she says. Her fingers tighten around the lantern as she considers your question.\n\n“I heard a bell beneath the ground before the town fell.”\n\nShe lets the words hang between you. A bell beneath the ground. Above her, the surviving tower rises out of the rain. Her account gives you something to follow, though an account is not yet an explanation.';
  } else {
    if (has('mark')) return { world, clarification: 'You have recorded the mark on the tower. Try asking the woman what happened, or wait until dusk.' };
    add('mark', 'At the foot of the tower, you discover a carved circle split by three lines.', ['ashford']);
    interpretation = 'You examine the surviving bell tower.';
    narration = 'You trace the tower’s base through the wet stone. Near your feet, a circle has been cut into the surface, crossed by three deliberate lines.\n\nYou copy the shape into your notebook. The mark is something you can return to, something that will still be here after the rain. What it means, and whether it has anything to do with the ruins, remains unanswered.';
  }
  const proposal: Proposal = { kind: 'action', interpretation, clarification: null, elapsedMinutes: elapsed, operations };
  const next = applyProposal(world, proposal);
  return { world: next, turn: { id, input, interpretation, changes: publicChanges(world,next), narration, revision: next.revision } };
}
export function newSample() { return { world: seedWorld(), turns: [] as PublicTurn[] }; }

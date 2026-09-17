import { applyProposal } from './reducer';
import { seedWorld, OPENING } from './seed';
import { publicChanges } from './view';
import { type World, type Proposal, type PublicTurn, type Operation } from './types';
export { OPENING };
export const suggestions = ['Ask the woman what happened', 'Examine the bell tower', 'Wait until dusk'];
export function demoTurn(world: World, input: string, id: string): { world: World; turn?: PublicTurn; clarification?: string } {
  const s = input.toLowerCase();
  const operations: Operation[] = [];
  const has = (id: string) => world.facts.some(f => f.id === id);
  const add = (id: string, text: string, subjects: string[], at = world.minute + 5) => operations.push({ op: 'establish_fact', fact: { id, key: `sample.${id}`, text, subjects, at, knownBy: ['player'] } });
  let narration = '', elapsed = 5, interpretation = '';
  if (/wait|rest|dusk/.test(s)) {
    const dusk = world.scheduled.find(e => e.id === 'dusk')!;
    if (dusk.resolved) return { world, clarification: 'The sample has reached dusk. Try speaking to the woman or examining the tower.' };
    elapsed = Math.max(0, dusk.dueAt - world.minute);
    add('shelter', 'At dusk, the woman takes shelter inside the bell tower.', ['mara','ashford'], dusk.dueAt);
    operations.push({ op: 'resolve_event', id: 'dusk', factId: 'shelter' });
    interpretation = 'You wait in Ashford until dusk.';
    narration = 'The light drains from the archway. At last the woman closes her hand around the lantern’s handle and crosses to the bell tower.\n\nYou watch her disappear into its shelter. Ashford is quiet around you. The ruins have kept their silence all day; now the last of the daylight goes with her.';
  } else if (/woman|mara|speak|ask|talk/.test(s)) {
    if (has('mara_name')) return { world, clarification: 'In this short sample, she has told you what she knows. Try examining the bell tower or waiting until dusk.' };
    add('mara_name', 'The woman at the arch introduces herself as Mara.', ['mara']);
    operations.push({ op: 'add_claim', claim: { id: 'mara_testimony', speakerId: 'mara', text: 'I heard a bell beneath the ground before the town fell.', knownBy: ['player'] } });
    interpretation = 'You ask the woman what happened to Ashford.';
    narration = '“Mara,” she says, when you ask her name. Her fingers tighten around the lantern.\n\n“I heard a bell beneath the ground before the town fell.”\n\nShe lets the words hang between you. A bell beneath the ground. Above her, the surviving tower rises out of the rain. Her account gives you something to follow, though an account is not yet an explanation.';
  } else if (/tower|examine|inspect|search|look/.test(s)) {
    if (has('mark')) return { world, clarification: 'You have recorded the mark on the tower. Try asking the woman what happened, or wait until dusk.' };
    add('mark', 'At the foot of the tower, you discover a carved circle split by three lines.', ['ashford']);
    interpretation = 'You examine the surviving bell tower.';
    narration = 'You trace the tower’s base through the wet stone. Near your feet, a circle has been cut into the surface, crossed by three deliberate lines.\n\nYou copy the shape into your notebook. The mark is something you can return to, something that will still be here after the rain. What it means, and whether it has anything to do with the ruins, remains unanswered.';
  } else {
    return { world, clarification: 'This is a scripted sample of the world engine. Try asking the woman what happened, examining the bell tower, or waiting until dusk. Live adventures accept free-form actions.' };
  }
  const proposal: Proposal = { kind: 'action', interpretation, clarification: null, elapsedMinutes: elapsed, operations };
  const next = applyProposal(world, proposal);
  return { world: next, turn: { id, input, interpretation, changes: publicChanges(world,next), narration, revision: next.revision } };
}
export function newSample() { return { world: seedWorld(), turns: [] as PublicTurn[] }; }

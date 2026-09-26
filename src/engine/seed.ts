import type { World } from './types';
export const OPENING = 'At the edge of Ashford, rain settles into streets that no longer have houses. The town is gone. Its bell tower still stands.\n\nA woman in a weathered blue coat waits beneath the arch, turning an unlit lantern in her hands. She looks up as you approach.\n\n“If you came looking for someone,” she says, “you should start with their name.”';
export function seedWorld(name = 'Rowan', premise = 'A quiet, mysterious fantasy world where old promises carry weight. Discover what happened to Ashford.'): World {
  return {
    schemaVersion: 1, revision: 0, title: 'The Silence of Ashford', premise, playerId: 'player', minute: 480,
    entities: [
      { id: 'player', kind: 'character', name, description: 'A traveler who notices what others overlook.', locationId: 'ashford', ownerId: null, condition: 'Steady', knownBy: ['player'] },
      { id: 'ashford', kind: 'location', name: 'Ashford', description: 'A ruined town beneath an intact bell tower.', locationId: null, ownerId: null, condition: 'Destroyed', knownBy: ['player', 'mara'] },
      { id: 'mara', kind: 'npc', name: 'The woman at the arch', description: 'Her name is Mara. She keeps watch over the ruins.', locationId: 'ashford', ownerId: null, condition: 'Watchful', knownBy: ['player', 'mara'] },
      { id: 'order', kind: 'faction', name: 'The Hollow Choir', description: 'A secretive order that destroyed Ashford by ringing the buried bell.', locationId: null, ownerId: null, condition: 'Active', knownBy: [] },
      { id: 'tower', kind: 'location', name: 'The bell tower', description: 'The surviving bell tower in Ashford.', locationId: 'ashford', ownerId: null, condition: 'Intact', knownBy: ['player', 'mara'] },
      { id: 'lantern', kind: 'item', name: 'Unlit lantern', description: 'The lantern held by the woman at the arch.', locationId: null, ownerId: 'mara', condition: 'Unlit', knownBy: ['player', 'mara'] },
      { id: 'journal', kind: 'item', name: 'Weathered notebook', description: 'An empty travel notebook.', locationId: null, ownerId: 'player', condition: 'Worn', knownBy: ['player'] }
    ],
    facts: [
      { id: 'ruin', key: 'ashford.destruction', text: 'Ashford was destroyed three days before your arrival. The bell tower survived.', subjects: ['ashford'], at: -3840, knownBy: ['player', 'mara'] },
      { id: 'cause', key: 'ashford.destruction.cause', text: 'The Hollow Choir destroyed Ashford by ringing a buried bell.', subjects: ['ashford', 'order'], at: -3840, knownBy: [] },
      { id: 'arrival', key: 'player.arrival', text: 'You arrived in the rain. The woman at the arch wore a weathered blue coat and held an unlit lantern. She said that if you were looking for someone, you should start with their name.', subjects: ['player', 'mara', 'ashford', 'lantern'], at: 480, knownBy: ['player', 'mara'] },
      { id: 'ability', key: 'player.background', text: 'You are a traveler with a patient ear and an eye for overlooked details.', subjects: ['player'], at: 0, knownBy: ['player'] }
    ],
    claims: [], quests: [{
      id: 'mystery', title: 'What remains of Ashford', description: 'Discover what destroyed the town, and whether anyone can still be helped.', status: 'active', knownBy: ['player'],
      guidance: {
        scope: 'arc', parentId: null, objective: 'Find a reliable account of what happened to Ashford and a concrete way to help.',
        stakes: 'What happened here may still matter to the people who remain.', entityIds: ['ashford', 'mara', 'tower'], lastProgressRevision: 0,
        leads: [
          { id: 'ask_woman', text: 'Ask the woman what brought her to the ruins.', action: 'Ask the woman what she is doing here, and whether there is something I can help with.', entityIds: ['mara'], evidenceFactIds: ['arrival'], evidenceClaimIds: [] },
          { id: 'inspect_tower', text: 'Investigate the tower that survived.', action: 'Examine the surviving bell tower for clues to what happened to Ashford.', entityIds: ['tower', 'ashford'], evidenceFactIds: ['ruin'], evidenceClaimIds: [] },
        ],
      },
    }],
    story: { focusQuestId: 'mystery', quietTurns: 0, lastProgressRevision: 0 },
    rules: [{ id: 'memory', text: 'Magic can preserve a memory, but cannot change an event that has already happened.', knownBy: ['player'] }],
    scheduled: [{ id: 'dusk', dueAt: 1080, description: 'At dusk, Mara leaves the exposed arch and takes shelter in the bell tower.', subjects: ['mara', 'tower'], resolved: false }]
  };
}

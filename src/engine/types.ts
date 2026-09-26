import { z } from 'zod';

export const ENGINE_VERSION = '1.3.0';
const id = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().min(1).max(1200);
export const itemStateSchema = z.object({ quantity: z.number().int().min(0).max(99), consumable: z.boolean(), usable: z.boolean() });
export const entitySchema = z.object({ id, kind: z.enum(['character', 'npc', 'location', 'faction', 'item']), name: z.string().min(1).max(100), description: text, locationId: id.nullable(), ownerId: id.nullable(), condition: z.string().max(200), knownBy: z.array(id).max(50), itemState: itemStateSchema.optional() });
export const factSchema = z.object({ id, key: z.string().min(1).max(160), text, subjects: z.array(id).min(1).max(10), at: z.number().int(), knownBy: z.array(id).max(50) });
export const claimSchema = z.object({ id, speakerId: id, text, knownBy: z.array(id).max(50) });
export const questSchema = z.object({ id, title: z.string().min(1).max(120), description: text, status: z.enum(['active', 'completed', 'failed']), knownBy: z.array(id).max(50) });
export const questScopeSchema = z.enum(['world', 'arc', 'local', 'immediate']);
export const questLeadSchema = z.object({
  id, text: z.string().min(1).max(160), action: z.string().min(1).max(500),
  entityIds: z.array(id).max(8), evidenceFactIds: z.array(id).max(8), evidenceClaimIds: z.array(id).max(8)
});
export const questUpdateSchema = z.object({
  questId: id, scope: questScopeSchema, parentId: id.nullable(),
  objective: z.string().min(1).max(300), stakes: z.string().min(1).max(300),
  entityIds: z.array(id).max(8), leads: z.array(questLeadSchema).max(3)
});
export const questGuidanceSchema = questUpdateSchema.omit({ questId: true }).extend({ lastProgressRevision: z.number().int().min(0) });
// Guidance is additive save metadata. Keep the legacy add_quest operation unchanged.
export const storedQuestSchema = questSchema.extend({ guidance: questGuidanceSchema.optional() });
export const storyStateSchema = z.object({ focusQuestId: id.nullable(), quietTurns: z.number().int().min(0), lastProgressRevision: z.number().int().min(0) });
export const storyPlanSchema = z.object({
  focusQuestId: id.nullable(), questUpdates: z.array(questUpdateSchema).max(3),
  progress: z.array(z.object({ questId: id, factIds: z.array(id).max(8), claimIds: z.array(id).max(8) })).max(3)
});
export const ruleSchema = z.object({ id, text, knownBy: z.array(id).max(50) });
export const scheduledSchema = z.object({ id, dueAt: z.number().int().min(0), description: text, subjects: z.array(id).min(1).max(10), resolved: z.boolean() });
export const operationSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create_entity'), entity: entitySchema }),
  z.object({ op: z.literal('update_entity'), id, field: z.enum(['locationId', 'ownerId', 'condition']), value: z.string().max(200).nullable() }),
  z.object({ op: z.literal('discover_entity'), id, characterId: id }),
  z.object({ op: z.literal('establish_fact'), fact: factSchema }),
  z.object({ op: z.literal('learn_fact'), id, characterId: id }),
  z.object({ op: z.literal('add_claim'), claim: claimSchema }),
  z.object({ op: z.literal('add_quest'), quest: questSchema }),
  z.object({ op: z.literal('update_quest'), id, status: z.enum(['completed', 'failed']) }),
  z.object({ op: z.literal('add_rule'), rule: ruleSchema }),
  z.object({ op: z.literal('schedule_event'), event: scheduledSchema }),
  z.object({ op: z.literal('resolve_event'), id, factId: id })
]);
export const proposalSchema = z.object({ kind: z.enum(['action', 'clarification']), interpretation: z.string().min(1).max(500), clarification: z.string().max(500).nullable(), elapsedMinutes: z.number().int().min(0).max(720), operations: z.array(operationSchema).max(20) });
export const itemActionSchema = z.object({ action: z.enum(['use', 'take', 'drop', 'give', 'receive', 'consume', 'damage', 'repair']), itemId: id.nullable(), quantity: z.number().int().min(1).max(99), recipientId: id.nullable() });
// Live proposals must declare their inventory actions; historical proposals keep their original shape.
export const inventoryProposalSchema = proposalSchema.extend({ itemActions: z.array(itemActionSchema).max(12) });
// Strict structured-output providers require every declared property to be
// required. Use explicit null on the wire while keeping existing saves and
// accepted engine proposals free of synthetic optional metadata.
const inventoryWireOperationSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('create_entity'), entity: entitySchema.extend({ itemState: itemStateSchema.nullable() }) }),
  ...operationSchema.options.slice(1),
]);
export const inventoryWireProposalSchema = inventoryProposalSchema.extend({ operations: z.array(inventoryWireOperationSchema).max(20) });
export const storyProposalSchema = inventoryProposalSchema.extend({ storyPlan: storyPlanSchema });
export const storyWireProposalSchema = inventoryWireProposalSchema.extend({ storyPlan: storyPlanSchema });
// Engine 1.3 keeps direction inside the fiction. Historical 1.2 schemas remain
// unchanged for replay; current proposals cannot generate preset player inputs.
export const narrativeQuestUpdateSchema = questUpdateSchema.omit({ leads: true }).strict();
export const narrativePlanSchema = storyPlanSchema.extend({ questUpdates: z.array(narrativeQuestUpdateSchema).max(3) }).strict();
export const narrativeProposalSchema = inventoryProposalSchema.extend({ storyPlan: narrativePlanSchema }).strict();
export const narrativeWireProposalSchema = inventoryWireProposalSchema.extend({ storyPlan: narrativePlanSchema }).strict();
export type NarrativePlan = z.infer<typeof narrativePlanSchema>;
export type NarrativeProposal = z.infer<typeof narrativeProposalSchema>;
export type QuestScope = z.infer<typeof questScopeSchema>;
export type QuestLead = z.infer<typeof questLeadSchema>;
export type QuestGuidance = z.infer<typeof questGuidanceSchema>;
export type Quest = z.infer<typeof storedQuestSchema>;
export type StoryPlan = z.infer<typeof storyPlanSchema>;
export type StoryProposal = z.infer<typeof storyProposalSchema>;
export interface PublicStoryDirection { focusQuestId: string | null; quietTurns: number }
export type ItemAction = z.infer<typeof itemActionSchema>;
export type InventoryProposal = z.infer<typeof inventoryProposalSchema>;
export type ItemState = z.infer<typeof itemStateSchema>;
export type Entity = z.infer<typeof entitySchema>;
export type Fact = z.infer<typeof factSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type Operation = z.infer<typeof operationSchema>;
export interface World {
  schemaVersion: 1; revision: number; title: string; premise: string; playerId: string; minute: number;
  entities: Entity[]; facts: Fact[]; claims: z.infer<typeof claimSchema>[]; quests: Quest[];
  rules: z.infer<typeof ruleSchema>[]; scheduled: z.infer<typeof scheduledSchema>[];
  story?: z.infer<typeof storyStateSchema>;
}
export interface PlayerView {
  title: string; revision: number; minute: number; playerId: string;
  character: { name: string; condition: string; location: string; possessions: string[] };
  inventory?: { id: string; name: string; quantity: number; consumable: boolean; usable: boolean }[];
  entities: { id: string; name: string; kind: Entity['kind'] }[];
  facts: { id: string; text: string; at: number; subjects: string[] }[];
  claims: { id: string; text: string; speaker: string }[];
  quests: { id: string; title: string; description: string; status: string; scope?: QuestScope; parentId?: string | null; objective?: string; stakes?: string }[];
  story?: PublicStoryDirection;
  rules: { id: string; text: string }[];
}
export interface PublicTurn { id: string; input: string; interpretation: string; changes: string[]; narration: string | null; revision: number; }
export const worldSchema = z.object({
  schemaVersion: z.literal(1), revision: z.number().int().min(0), title: text, premise: z.string().min(1).max(1600), playerId: id, minute: z.number().int().min(0),
  entities: z.array(entitySchema), facts: z.array(factSchema), claims: z.array(claimSchema), quests: z.array(storedQuestSchema), story: storyStateSchema.optional(), rules: z.array(ruleSchema), scheduled: z.array(scheduledSchema)
});
export const publicTurnSchema = z.object({ id: z.string(), input: z.string(), interpretation: z.string(), changes: z.array(z.string()), narration: z.string().nullable(), revision: z.number().int().min(0) });
export class EngineError extends Error { constructor(public code: string) { super(code); } }

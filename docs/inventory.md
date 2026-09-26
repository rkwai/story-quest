# Inventory and action requirements

Inventory is authoritative game state. Saying “my staff” cannot grant a staff, and earlier dialogue or narration cannot substitute for an owned item. The DM interprets the attempt; engine 1.1.0 checks its declared equipment requirements before committing any consequence. Prompt version: `dm-1.3.0`.

## Player experience

Character → What you carry lists each item with quantity, availability and whether it is consumable. The story composer has an Inventory shortcut. Use, Drop and Consume one prepare editable text and retain the selected item's stable ID; the player still sends the action explicitly. An unavailable tool cannot be selected for use. Archived adventures and the scripted preview show inventory without these action controls.

A blocked inventory attempt keeps the input for revision and explains the obstacle. The entire attempt is rejected: no world change, time advance, new accepted turn or revision, and no narration call. Existing possessions can be used, handed over or consumed through free-text roleplay as well as the item controls.

## Mechanical contract

Each live proposal must include `itemActions`, even when empty. Up to 12 ordered actions run against a clone before the ordinary world operations. Each action supplies `action`, an existing `itemId` or null for a missing requirement, positive `quantity`, and `recipientId` (only populated for give). All referenced items must already exist and be known to the player. A selected UI item must be carried in the reserved snapshot and must appear in an action proposal; duplicate display names cannot silently select a different ID.

| Action | Requirements and result |
| --- | --- |
| `use` | Carried, usable, sufficient quantity; does not consume the item. |
| `take` | Unowned, known item at the player's current location; transfers it to the player. |
| `drop` | Carried item; places it at the player's current location. |
| `give` | Carried item and a known NPC at that location; transfers to `recipientId`. |
| `receive` | Known item owned by a present, known NPC; transfers to the player. The DM adjudicates agreement. |
| `consume` | Carried, usable consumable with sufficient quantity; subtracts the requested amount. |
| `damage` | Carried or local unowned item; marks it unusable. |
| `repair` | Carried or local unowned item; marks it usable after the DM adjudicates a justified repair. |

Item state contains `quantity` (0–99), `consumable` and `usable`. Transfers, damage and repair apply to the whole stack. Consuming part of a stack leaves its remainder. At zero quantity the record remains for history but cannot be used or transferred and disappears from carried inventory. A freeform `condition` describes the item; it is not the mechanical availability flag.

Actions run in order. Taking an already established local item and using it can succeed in one turn. Using an item after dropping it or consuming its final unit fails the whole proposal. A failure later in world validation also discards all tentative inventory changes. Accepted item actions and public changes are stored with the turn, so narration receives committed outcomes rather than permission to invent equipment.

The generic `update_entity` operation cannot change an item's owner or location. The DM can still introduce world objects, offscreen objects or NPC-owned items with valid placement and knowledge. It cannot create an item directly owned by the player or refill an existing stack. A new item cannot appear in that turn's item actions: discovering an object and acquiring or using it takes separate turns. Once it exists, the usual known-item, ownership and reach checks apply. Moving to a location then picking up its item also requires separate turns in this slice.

## Existing adventures and replay

No seed, existing item, accepted proposal or narration is rewritten. Old items without mechanical state behave as one reusable, usable object; defaults are computed without inferring hidden attributes from prose. The stored world format remains version 1. New proposal wire data explicitly supplies nullable `itemState`; historical records may omit it.

`replayVersioned` dispatches accepted 1.0.0 proposals to the original reducer and 1.1.0 proposals to the inventory reducer. Unknown engine versions fail explicitly. A historically accepted unsupported staff action remains history; it does not grant a staff for a new action. Reset still uses the original stored seed.

After a campaign accepts 1.1.0 turns, an application rollback must retain inventory support. A pre-1.1 app ignores quantity and usable state, so it could show depleted gear as carried and allow invalid use. Prefer a corrected inventory-aware release; do not roll back to the earlier application merely because the JSON is readable.

## Regression and limits

The motivating incident involved a traveler carrying only a notebook. Earlier NPC dialogue and narration acknowledged an unrecorded staff, then a staff strike changed a bell and established an outcome fact. The proposal never referenced a staff entity, so ordinary referential integrity could not detect it. `tests/fixtures/missing-staff.json` captures a minimal anonymized reproduction, including the misleading prior prose.

The inventory gate is deterministic for declared item actions. The DM still has to recognize every equipment dependency in free text; a structurally valid empty list can omit a semantic requirement. Strict proposal shape and explicit inventory instructions improve this boundary but do not prove completeness. There is no extra keyword classifier or model call. Narration fidelity, NPC consent, repair plausibility and arbitrary world-rule semantics remain model responsibilities requiring evaluations.

This slice has no equipment slots, encumbrance, stack splitting/merging, crafting, resource replenishment or ability/spell system. Reach uses the current location's exact ID, not arbitrary adjacency or nested-location traversal. NPC possessions are not automatically usable by the player. Existing objects are not reclassified from private descriptions, and object portability remains a DM judgment. Further mechanics should add typed state and operations with versioned replay, rather than infer rules from descriptive text.

Verification and production status belong in [implementation status](implementation.md). See [maintenance](maintenance.md#inventory-diagnostics) for trace interpretation and acceptance checks.

# Product and experience

## The promise

Tell the DM what you attempt. The world responds consistently and remembers. The primary pleasure is discovery, character relationships and consequences, not numerical optimization.

## Phone-first navigation

The home screen is a shared adventure lobby with a prominent **Start a new adventure** action and existing active/archived runs. No login or account creation intervenes. Inside an adventure, four persistent destinations: **Story**, **Character**, **Journal**, **World**. Story has generous readable text, recent actions, short committed change notes, and a multiline input. Enter inserts a new line; Cmd+Enter on Mac, Ctrl+Enter elsewhere, or the send button submits the action. Preserve input on failures. During processing, show a prominent status panel, an active spinner in the send button and the current stage: considering the action or writing the passage. Announce status accessibly and prevent duplicate submissions. Desktop adds breathing room without changing the interaction model.

Story is ordered from top to bottom: **action input → newest scene → scrollable older interactions**. The newest scene is fully readable; older interactions appear newest first in a separate bounded, keyboard-focusable history region, with the opening scene last. Do not add visible “Latest interaction” or “Past story” labels. Before the first turn, the opening is the current story. Pending status and errors stay beside the input. Navigating into Story returns to the composer. Each interaction displays the narration before the submitted action and committed change notes. After the player submits an action, its new response is brought into view when ready. Reading history or retrying an older narration does not pull the reader away. Stored history and replay remain chronological; only presentation is reversed.

Character shows identity, condition, abilities, carried items and known relationships. Journal separates quests, discoveries and witnessed claims; quests retain their scope, parent, objective and stakes, without a “Known leads” prompt list. World exposes discovered people/places and known rules only. Secrets stay server-side. A rumor is labeled a claim, not presented as an objective fact.

The DM gives direction through NPC dialogue, discoveries, obstacles and consequences. The player decides how to respond in free text. Do not generate or display preset narrative actions. Fixed inventory Use/Drop/Consume controls still prepare editable actions, and the clearly labeled no-AI preview retains its scripted buttons.

## Starting a campaign

First slice: a seeded mystery at Ashford. **Start a new adventure** starts a run immediately with defaults. Optional customization accepts a character name, high-level premise and lore; seed facts constrain the opening. Broader AI-authored onboarding is tracked in the roadmap.

This is an **open shared playtest**. Every visitor can list, resume and act in any active adventure; runs are not private or tied to a browser/account. The Adventures lobby offers Continue and Delete controls. Reset is available within the selected active adventure. Reset starts again from the original seed and retains the prior run as a read-only archive. Delete requires confirmation, then permanently removes the selected run, its accepted turns and diagnostics. Reset does not imply deletion. Deleting one run does not delete another run created by an earlier reset.

A separate in-browser preview demonstrates mechanics without paid calls. It is prominently labeled “Scripted preview · No AI” and offers only preset buttons. It is an optional destination, not the default entry into the product. Free-text roleplay is available inside an AI adventure without sign-in.

## A turn

Player input -> interpretation and ruling -> validated commit -> narration. The engine records consequences before generating prose; the finished interaction presents prose first, followed by the submitted action and recorded changes. Talking, asking, observing and attempting actions share one input. A clarification does not advance time or mutate the world. Ambiguous irreversible actions should be clarified rather than guessed. Narrative opportunities remain optional and must preserve the topic and intent of the player's input.

If an API fails before commitment, the world stays unchanged. If narration fails after commitment, show the recorded outcome and keep the committed world. A retry must reuse the turn ID.

## Established truths

A town's destruction can exist as a fact while its cause remains undetermined. If an NPC was established as responsible, that stays true even before discovery. A survivor's accusation records a claim. Discovery changes knowledge, not history. World entities may change now; their prior states remain in the event history. Rules may evolve prospectively only with an explicit story event and eventual versioned rule support.

## Deferred

Art, audio, real-time simulation, tactical battle maps, multiplayer, autonomous per-NPC agents, D&D rules compliance, arbitrary model-written code, and a marketplace. Avoid adding infrastructure for these before the core storytelling loop proves itself.

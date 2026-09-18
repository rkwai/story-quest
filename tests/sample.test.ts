import test from 'node:test';
import assert from 'node:assert/strict';
import { demoTurn, suggestions } from '../src/engine/demo';
import { seedWorld } from '../src/engine/seed';

test('the sample does not rewrite the reported roleplay requests into a different action', () => {
  for (const input of [
    'what are you doing in this desolate area',
    'Ask the woman what she is doing here still',
  ]) {
    const before = seedWorld();
    const original = structuredClone(before);
    const result = demoTurn(before, input, 'unsupported-roleplay');
    assert.equal(result.world, before);
    assert.deepEqual(result.world, original);
    assert.equal(result.turn, undefined);
    assert.match(result.clarification ?? '', /scripted sample only supports the displayed choices/);
    assert.match(result.clarification ?? '', /has not changed the story/);
    assert.match(result.clarification ?? '', /live adventure/);
  }
});

test('sample keywords and edited choices never execute an authored scene', () => {
  for (const input of [
    'Ask Mara about her lantern',
    'I do not want to wait until dusk',
    'Examine the bell tower without approaching it',
    ...suggestions.map(choice => `${choice}, then leave town`),
  ]) {
    const before = seedWorld();
    const result = demoTurn(before, input, 'unsupported-edited-choice');
    assert.equal(result.world, before);
    assert.equal(result.world.revision, 0);
    assert.equal(result.turn, undefined);
  }
});

test('explicit sample choices still create their authored outcomes without inventing a player name question', () => {
  let world = seedWorld();
  for (const [index, choice] of suggestions.entries()) {
    const result = demoTurn(world, choice, `sample-${index}`);
    assert.ok(result.turn);
    assert.equal(result.turn.input, choice);
    assert.equal(result.world.revision, world.revision + 1);
    if (index === 0) {
      assert.equal(result.turn.interpretation, 'You ask the woman what happened to Ashford.');
      assert.ok(result.turn.narration);
      assert.match(result.turn.narration, /My name is Mara/);
      assert.doesNotMatch(result.turn.narration, /ask her name/);
      assert.equal(result.world.claims.length, 1);
    }
    world = result.world;
  }
  assert.equal(world.entities.find(entity => entity.id === 'mara')?.locationId, 'tower');
  assert.ok(world.facts.some(fact => fact.id === 'mark'));
  assert.ok(world.scheduled.find(event => event.id === 'dusk')?.resolved);
});

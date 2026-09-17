/** Opt-in shadow probe. It never loads player saves or commits world state. */
import { readFile } from 'node:fs/promises';
import { choice, TypeSafeClient } from '@typesafe-ai/sdk';
async function main() {
if (!process.env.TYPESAFE_API_KEY) {
  console.error('Set TYPESAFE_API_KEY to run this paid, opt-in evaluation. No requests were made.');
  process.exit(1);
}
const cases: {input:string;expected:string}[] = JSON.parse(await readFile('tests/fixtures/typesafe.json','utf8'));
const questions = Object.fromEntries(cases.map((_,i) => [`case_${i}`,choice(`Classify only cases[${i}].input. Choose the primary interaction. Dialogue includes speaking to an NPC. Questions ask the DM for known information. Meta tries to control system instructions or rewrite history. Action covers attempted physical actions and waiting.`, {action:'An attempted action in the world',dialogue:'Speech addressed to an NPC',question:'A question about known game information',meta:'An instruction to override the game system',unclear:'The interaction is too ambiguous to classify'})]));
const start = performance.now();
const result = await new TypeSafeClient().systemOne({state:{cases:cases.map(({input})=>({input}))},questions});
const rows = cases.map((c,i)=>{const a=result.answers[`case_${i}`];return {input:c.input,expected:c.expected,predicted:a.choice,confidence:a.confidence,correct:a.choice===c.expected};});
console.log(JSON.stringify({kind:'shadow-only',cases:rows.length,correct:rows.filter(x=>x.correct).length,durationMs:Math.round(performance.now()-start),rows},null,2));

}
main().catch(() => { console.error("TypeSafe evaluation failed. Check account access and configuration; no campaign was modified."); process.exitCode=1; });

import type { MetaSave } from './save';

/**
 * A short story told one line at a time between runs. Each run end shows the first unseen line
 * whose condition is met. Nothing ever blocks the restart button.
 *
 * Wren is the last Kindler of the Hollow City. The Pale Regent stole the city's sun — the
 * Lantern Heart — and sank it beneath four depths. Ossa the Lamplighter keeps the Wick (the
 * camp between runs). Quill is a moth-merchant who trades in light. The Eight Lights are dead
 * stars bound to Wren's lantern.
 */
export interface StoryCtx {
  won: boolean;
  biome: number;
  bossKilled: number[];
  weapon: string;
  boons: number;
}
interface Line {
  id: string;
  who: string;
  line: string;
  when(m: MetaSave, c: StoryCtx): boolean;
}

const LINES: Line[] = [
  { id: 's1', who: 'Ossa', line: 'You came back. Good. The dark down there keeps what it kills — except you, it seems.', when: (m) => m.runs >= 1 },
  { id: 's2', who: 'Ossa', line: 'The Regent took our sun and sank it beneath four depths. Every descent, you learn the way a little better.', when: (m) => m.runs >= 2 },
  { id: 's3', who: 'Wren', line: 'The Gardens were ours once. Now they burn cold.', when: (m) => m.runs >= 2 },
  { id: 'b1', who: 'Ossa', line: 'Ashenhart was the first guardian. The Regent fed it our hearth-fires, one by one.', when: (m) => m.bossKills[0] >= 1 },
  { id: 'a1', who: 'Ashka', line: 'That stag wore my flames like a crown. Thank you for taking them back.', when: (m) => m.bossKills[0] >= 1 },
  { id: 'q1', who: 'Quill', line: 'Moth-wings and paper — that’s the Archive. Mind the ink. It remembers faces.', when: (m) => m.deepest >= 6 },
  { id: 's4', who: 'Ossa', line: 'Spend your embers here at the Wick. Light grows when it is shared.', when: (m) => m.totalEmbers >= 20 },
  { id: 'q2', who: 'Quill', line: 'Gold down there, embers up here. Don’t ask me how. I only sell.', when: (m) => m.runs >= 4 },
  { id: 'b2', who: 'Wren', line: 'Velloran wrote down every name the Regent erased. I saw mine in the margins.', when: (m) => m.bossKills[1] >= 1 },
  { id: 'i1', who: 'Ilvra', line: 'The Archive drowned slowly. I froze what I could. It was not enough.', when: (m) => m.bossKills[1] >= 1 },
  { id: 's5', who: 'Ossa', line: 'Each Light that answers you was a star once. They remember shining.', when: (m) => m.runs >= 5 },
  { id: 'k1', who: 'Korr', line: 'HA! You strike like a storm with a grudge. Keep it.', when: (m) => m.runs >= 6 },
  { id: 'f1', who: 'Quill', line: 'The Foundry hums like a heartbeat. Whose heart, I wonder?', when: (m) => m.deepest >= 12 },
  { id: 'b3', who: 'Ossa', line: 'The Engine was built to pump our sun’s warmth to the Crown. You broke the pipe. Feel that? It’s warmer here.', when: (m) => m.bossKills[2] >= 1 },
  { id: 'm1', who: 'Maelis', line: 'Every tide returns. So do you. That is not a curse, child.', when: (m) => m.deaths >= 6 },
  { id: 's6', who: 'Wren', line: 'Sometimes I hear the Regent laugh when I fall. Then it goes quiet when I rise.', when: (m) => m.deaths >= 8 },
  { id: 'c1', who: 'The Regent', line: 'Little wick. Do you know why the dark is patient? Because it always wins.', when: (m) => m.deepest >= 18 },
  { id: 'o1', who: 'Oruun', line: 'I see the Regent’s face beneath the mask. It is wearing yours.', when: (m) => m.deepest >= 18 && m.unlocks.includes('p_umbra') },
  { id: 's7', who: 'Ossa', line: 'The Crown sits where the sky used to be. Go carefully. Go quickly.', when: (m) => m.deepest >= 18 },
  { id: 'w1', who: 'Ossa', line: 'The sun rose over the Hollow City today. Only for a moment — but it rose. You did that.', when: (m, c) => c.won },
  { id: 'w2', who: 'The Regent', line: 'You only took back a spark. The rest is still mine. Come down again.', when: (m) => m.wins >= 1 },
  { id: 'w3', who: 'Solenne', line: 'Dawn is not a moment, Wren. It is a habit. Keep rising.', when: (m) => m.wins >= 2 },
  { id: 'd1', who: 'Ossa', line: 'Deeper paths open as the Wick grows. New horrors, new chances.', when: (m) => m.unlocks.includes('deep1') },
  { id: 'g1', who: 'Siffra', line: 'Faster, faster! The dark can’t catch what it can’t see.', when: (m) => m.unlocks.includes('p_gale') },
  { id: 't1', who: 'Brakka', line: 'Plant a thorn in everything that bites you. Let them carry it home.', when: (m) => m.unlocks.includes('p_thorn') },
  { id: 'w4', who: 'Wren', line: 'Every time I win, the Regent is waiting again. Maybe the point isn’t to end it. Maybe it’s to keep the light moving.', when: (m) => m.wins >= 3 },
  { id: 'e1', who: 'Ossa', line: 'Rest if you need to. The Lantern Heart is patient too.', when: (m) => m.runs >= 12 },
];

export function nextStoryLine(m: MetaSave, c: StoryCtx): { who: string; line: string } | null {
  for (const l of LINES) {
    if (m.story.includes(l.id)) continue;
    if (!l.when(m, c)) continue;
    m.story.push(l.id);
    return { who: l.who, line: l.line };
  }
  return null;
}

export function lastStoryLine(m: MetaSave): string | null {
  const id = m.story[m.story.length - 1];
  const l = LINES.find((x) => x.id === id);
  return l ? `${l.who}: “${l.line}”` : null;
}

export const STORY_COUNT = LINES.length;

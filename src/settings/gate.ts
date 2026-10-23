/** Parental gate: a multiplication that young children cannot answer yet. */
export interface GateQuestion {
  a: number;
  b: number;
}

const MIN = 3;
const MAX = 9;

/** Picks two factors in 3–9. `random` returns [0, 1) like Math.random. */
export function createGateQuestion(random: () => number = Math.random): GateQuestion {
  const pick = () => MIN + Math.min(MAX - MIN, Math.floor(random() * (MAX - MIN + 1)));
  return { a: pick(), b: pick() };
}

/** True when the typed digits equal the product. */
export function checkGateAnswer(question: GateQuestion, answer: string): boolean {
  if (!/^\d{1,3}$/.test(answer)) return false;
  return Number(answer) === question.a * question.b;
}

// Deterministic stand-in for Groq. Reads the real prompts, cites real [sN] ids, varies output by template.
const ids = (user: string) => [...user.matchAll(/^\[s(\d+) [\d:]+\] ([^:]+): (.*)$/gm)].map((m) => ({ id: Number(m[1]), who: m[2], text: m[3] }));

export async function fakeComplete(system: string, user: string): Promise<string> {
  if (system.includes("You answer questions about a user's recorded meetings")) {
    const srcs = [...user.matchAll(/^\[(S\d+)\]/gm)].map((m) => m[1]);
    const grounded = !/ZZZ-UNANSWERABLE/.test(user);
    return JSON.stringify({ found: grounded, answer: grounded ? `Found it in ${srcs.length} places [${srcs[0]}] and also [${srcs[1] ?? srcs[0]}] and a bogus one [S99].` : "Nothing about that.", citations: grounded ? [srcs[0], "S99"] : [] });
  }
  const lines = ids(user);
  const at = (n: number) => lines[Math.min(n, lines.length - 1)]?.id ?? 0;
  if (system.includes("TASK: analyse")) {
    const keys = [...system.matchAll(/^\s+"(\w+)": \[\{"text": string, "segment": int\}\]/gm)].map((m) => m[1]);
    const template = /Template: ([A-Za-z ]+)\./.exec(system)?.[1] ?? "?";
    return JSON.stringify({
      topics: [template, "Planning"],
      keyPoints: [0, 2, 4].map((n) => ({ text: `${template} key point ${n}`, segment: at(n) })),
      questions: [{ text: "Is this ready?", askedBy: lines[1]?.who, segment: at(1), answered: true }],
      risks: [{ text: "Schedule risk", severity: "high", segment: at(3) }],
      sections: Object.fromEntries(keys.map((k) => [k, [{ text: `${template} / ${k}`, segment: at(2) }]])),
    });
  }
  if (system.includes("TASK: write the meeting summary")) return JSON.stringify({ summary: `Summary written in ${/Template: ([A-Za-z ]+)\./.exec(system)?.[1]} style for the meeting.` });
  if (system.includes("TASK: list the decisions")) return JSON.stringify({ decisions: lines.filter((l) => /decide|agreed|let's make that official/i.test(l.text)).slice(0, 3).map((l) => ({ text: l.text, owner: l.who, segment: l.id })) });
  if (system.includes("TASK: list action items"))
    return JSON.stringify({ actionItems: lines.filter((l) => /I'll|I will/.test(l.text)).slice(0, 6).map((l) => ({ text: `Follow up: ${l.text.slice(0, 60)}`, owner: l.who, due: null, segment: l.id })) });
  return JSON.stringify({ highlights: [1, 3].map((n) => ({ title: `Moment ${n}`, note: "Worth revisiting.", segment: at(n) })) });
}

/** Graph node ids in execution order, with the labels the processing UI shows. */
export const STEPS = [
  { id: "analyze", label: "Analysing transcript" },
  { id: "summarize", label: "Writing summary" },
  { id: "extractDecisions", label: "Finding decisions" },
  { id: "extractActions", label: "Extracting action items" },
  { id: "pickHighlights", label: "Selecting highlights" },
  { id: "finalize", label: "Verifying & assembling" },
] as const;

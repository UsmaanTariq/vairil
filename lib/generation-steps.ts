export type LoadingStep = { label: string; after: number };

export const IDEAS_GENERATION_STEPS: LoadingStep[] = [
  { label: 'Writing hooks & scripts', after: 0 },
  { label: 'Running quality check', after: 22000 },
  { label: 'Refining weak ideas', after: 45000 },
  { label: 'Finalising your idea board', after: 70000 },
];

export const IDEAS_REGEN_ONE_STEPS: LoadingStep[] = [
  { label: 'Generating replacement idea', after: 0 },
  { label: 'Almost there', after: 15000 },
];

export const RESEARCH_STEPS: LoadingStep[] = [
  { label: 'Searching trending content', after: 0 },
  { label: 'Analysing search results', after: 12000 },
  { label: 'Identifying relevant trends', after: 22000 },
];

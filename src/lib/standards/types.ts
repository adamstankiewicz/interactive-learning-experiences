/**
 * The pluggable seam between the pathway pipeline and whatever authoritative
 * standards graph backs it. Learning Commons is one implementation of this
 * (`learning-commons.ts`); an adopter without access to it — a different
 * country, a different subject, a homegrown curriculum graph — implements
 * this same interface instead of forking the pipeline.
 */

export type StandardRef = {
  /** Which StandardsSource resolved this — lets UI copy credit the right graph. */
  sourceId: string;
  /** Human label for that source, carried on the ref itself so client components
   *  can display it without importing the (server-only) source registry. */
  sourceLabel: string;
  /** Human-facing code, e.g. "3.NF.A.1". */
  code: string;
  /** Opaque id the source uses internally to look up decomposition/progression. */
  id: string;
  description: string;
  jurisdiction: string;
  gradeLevels: string[];
  subject: string;
  /**
   * Semantic tags a widget's `coverageRule` matches against instead of a
   * regex on `code` — e.g. ['fractions'], ['writing-argument'],
   * ['reading-evidence']. Classification is the source's job: a CCSS source
   * and a state-standards source both produce the same tag vocabulary even
   * though their code notations differ completely.
   */
  tags: string[];
  /**
   * False only for the synthetic ref `streamPathway` builds when no proposed
   * code resolves against any active source — an honest "we couldn't verify
   * this against a standard" pathway instead of a dead end. Every real
   * source-returned ref sets this true; nothing else should ever set it false.
   */
  verified: boolean;
};

export type LearningComponentRef = {
  id: string;
  description: string;
};

export interface StandardsSource {
  /** Short id, used in UI copy ("Matched against the {label} graph") and StandardRef.sourceId. */
  id: string;
  /** Human label for the source, e.g. "Learning Commons". */
  label: string;
  /** Injected into the propose-codes system prompt: notation, examples, dos/don'ts. */
  proposalPromptFragment: string;
  /** Resolve a candidate code against the graph. Null means the code doesn't exist — the model hallucinated it. */
  verify(code: string, jurisdiction?: string): Promise<StandardRef | null>;
  /** Fine-grained teachable skills for a standard. Empty when the source has no decomposition for it. */
  decompose(standard: StandardRef): Promise<LearningComponentRef[]>;
  /** Prerequisite (backward) or extension (forward) standards. Empty when no crosswalk exists. */
  progression(standard: StandardRef, direction: 'backward' | 'forward'): Promise<StandardRef[]>;
}

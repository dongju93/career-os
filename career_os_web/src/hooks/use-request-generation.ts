import { useState } from 'react';

/**
 * Identifies each fetch by a fresh generation, so loading state means "this
 * fetch has not settled" rather than "these parameters have not settled".
 *
 * Parameters repeat (A → B → A) while fetches do not: comparing query keys would
 * treat the new request for A as finished because an earlier one for A was.
 *
 * Run the fetch in an effect that depends on `generation`, and call
 * `markSettled(generation)` only if that request was not aborted.
 *
 * @param queryKey Identity of the current request parameters. Changing it starts
 *   a new generation.
 */
export function useRequestGeneration(queryKey: string) {
  const [latest, setLatest] = useState({ queryKey, generation: 0 });
  const [settledGeneration, markSettled] = useState<number | null>(null);

  // Adjust during render, not in an effect: React discards this pass and
  // re-renders before committing, so no frame pairs the new query with the
  // previous generation's "settled" state.
  if (latest.queryKey !== queryKey) {
    setLatest({ queryKey, generation: latest.generation + 1 });
  }

  function retry() {
    setLatest((current) => ({
      ...current,
      generation: current.generation + 1,
    }));
  }

  return {
    generation: latest.generation,
    isLoading: settledGeneration !== latest.generation,
    markSettled,
    retry,
  };
}

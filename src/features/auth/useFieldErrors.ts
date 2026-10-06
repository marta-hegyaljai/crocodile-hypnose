import { useCallback, useState } from 'react';

import { t } from '@/copy';

import type { DescribedError } from './describeError';
import type { FieldProblem } from './validation';

/** Per-field messages for a form: set from validation or from the server, cleared on edit. */
export function useFieldErrors<F extends string>() {
  const [problems, setProblems] = useState<Partial<Record<F, FieldProblem | DescribedError>>>({});

  const message = useCallback(
    (field: F): string | null => {
      const p = problems[field];
      return p ? t(p.key, p.params) : null;
    },
    [problems],
  );

  const setField = useCallback((field: F, problem: FieldProblem | DescribedError | null) => {
    setProblems((prev) => {
      if (!problem && !prev[field]) return prev;
      const next = { ...prev };
      if (problem) next[field] = problem;
      else delete next[field];
      return next;
    });
  }, []);

  return { problems, setProblems, message, setField };
}

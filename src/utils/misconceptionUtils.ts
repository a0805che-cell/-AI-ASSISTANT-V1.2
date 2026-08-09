import { AssessmentResult, MisconceptionFound } from '../types';

/**
 * Normalizes and extracts all misconceptions and concept-map logic errors from an AssessmentResult object.
 * Guarantees 100% synchronization between 'misconceptions' array and 'conceptMapAnalysis.identified_errors'.
 */
export function getCombinedMisconceptions(result: AssessmentResult): MisconceptionFound[] {
  if (!result) return [];
  const list: MisconceptionFound[] = [];
  const seenKeys = new Set<string>();

  // 1. Existing misconceptions array
  if (result.misconceptions && Array.isArray(result.misconceptions)) {
    result.misconceptions.forEach((m) => {
      const code = m.code || 'MISC';
      const title = m.conceptTitle || '';
      const key = `${code}:${title}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        list.push(m);
      }
    });
  }

  // 2. Concept Map Analysis identified_errors
  if (result.conceptMapAnalysis?.identified_errors && Array.isArray(result.conceptMapAnalysis.identified_errors)) {
    result.conceptMapAnalysis.identified_errors.forEach((err, idx) => {
      const code = err.error_type || 'R1_LOGICAL_CATEGORY_MISMATCH';
      const title = err.error_location ? `${code}: ${err.error_location}` : (err.logic_violation || '概念構圖邏輯錯位');
      const key = `${code}:${title}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        list.push({
          id: `cm-err-${idx}`,
          code,
          conceptTitle: title,
          studentStatementExcerpt: err.student_wrote || '',
          logicViolation: err.logic_violation || '',
          remedialHint: err.generic_explanation || '請引導學生檢視父子概念階層與連接動詞邏輯。'
        });
      }
    });
  }

  return list;
}

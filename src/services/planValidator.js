/**
 * @fileoverview Event Plan Output Validation
 * @module services/planValidator
 */

const REQUIRED_TOP_LEVEL_KEYS = [
  'summary',
  'theme',
  'budget',
  'timelineMilestones',
  'runOfShow',
  'vendors',
  'personalizedIdeas'
];

/**
 * Checks if total budget deviates significantly from expected budget (> 25%).
 * @param {Object} parsed - Parsed plan object
 * @param {number} [expectedBudget] - Expected budget
 * @param {string[]} errors - Array to accumulate errors
 */
function checkBudgetDeviation(parsed, expectedBudget, errors) {
  if (typeof expectedBudget !== 'number' || typeof parsed?.budget?.total !== 'number') {
    return;
  }
  const diff = Math.abs(parsed.budget.total - expectedBudget);
  if (diff > expectedBudget * 0.25) {
    errors.push(
      `Budget total (${parsed.budget.total}) deviates significantly from expected budget (${expectedBudget}).`
    );
  }
}

/**
 * Checks for presence of all required top-level plan keys.
 * @param {Object} parsed - Parsed plan object
 * @param {string[]} errors - Array to accumulate errors
 */
function checkRequiredKeys(parsed, errors) {
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (parsed[key] === undefined || parsed[key] === null) {
      errors.push(`Missing required top-level key: "${key}".`);
    }
  }
}

/**
 * Validates summary field types.
 * @param {Object} [summary] - Summary object from plan
 * @param {string[]} errors - Array to accumulate errors
 */
function checkSummary(summary, errors) {
  if (!summary) return;
  if (typeof summary.guestCount !== 'number') {
    errors.push('summary.guestCount must be a number.');
  }
  if (typeof summary.budgetTotal !== 'number') {
    errors.push('summary.budgetTotal must be a number.');
  }
}

/**
 * Validates budget categories array items and sum consistency within 10%.
 * @param {Object} [budget] - Budget object from plan
 * @param {string[]} errors - Array to accumulate errors
 */
function checkBudgetCategories(budget, errors) {
  if (!budget) return;
  if (typeof budget.total !== 'number') {
    errors.push('budget.total must be a number.');
  }
  if (!Array.isArray(budget.categories) || budget.categories.length === 0) {
    errors.push('budget.categories must be a non-empty array.');
    return;
  }

  let allocatedSum = 0;
  budget.categories.forEach((cat, i) => {
    if (typeof cat.name !== 'string') {
      errors.push(`budget.categories[${i}].name must be a string.`);
    }
    if (typeof cat.allocated !== 'number') {
      errors.push(`budget.categories[${i}].allocated must be a number.`);
    } else {
      allocatedSum += cat.allocated;
    }
  });

  if (typeof budget.total === 'number' && allocatedSum > 0) {
    const diff = Math.abs(allocatedSum - budget.total);
    const tolerance = budget.total * 0.1;
    if (diff > tolerance) {
      errors.push(
        `Budget categories sum (${allocatedSum}) differs from budget.total (${budget.total}) by more than 10%.`
      );
    }
  }
}

/**
 * Validates that a parsed plan object contains the required structure and
 * internally-consistent budget figures.
 *
 * @param {Object} parsed - The parsed plan object from AI output
 * @param {number} [_expectedBudget] - Optional expected total budget for cross-check
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePlanOutput(parsed, _expectedBudget) {
  const errors = [];
  checkBudgetDeviation(parsed, _expectedBudget, errors);
  checkRequiredKeys(parsed, errors);
  checkSummary(parsed.summary, errors);
  checkBudgetCategories(parsed.budget, errors);

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors };
}

module.exports = { validatePlanOutput };

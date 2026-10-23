/**
 * @fileoverview JSON Extraction and Parsing Utility for AI Model Outputs
 * @module services/jsonParser
 */

/**
 * Extracts and parses valid JSON from raw or markdown-fenced AI output.
 * @param {string} rawText - Model output string
 * @returns {Object} Parsed JavaScript object
 * @throws {Error} If no valid JSON can be extracted
 */
function cleanAndParseJSON(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {}
    }
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(rawText.substring(firstBrace, lastBrace + 1));
      } catch {}
    }
    throw new Error('Malformed JSON received from AI engine.');
  }
}

module.exports = { cleanAndParseJSON };

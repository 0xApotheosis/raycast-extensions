import type { ModelSettings } from "../types";

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates temperature value (must be between 0 and 2)
 */
export const validateTemperature = (temperature: number): ValidationResult => {
  if (typeof temperature !== "number" || isNaN(temperature)) {
    return { isValid: false, error: "Temperature must be a number" };
  }
  if (temperature < 0 || temperature > 2) {
    return { isValid: false, error: "Temperature must be between 0.0 and 2.0" };
  }
  return { isValid: true };
};

/**
 * Validates top_p value (must be between 0 and 1)
 */
export const validateTopP = (topP: number): ValidationResult => {
  if (typeof topP !== "number" || isNaN(topP)) {
    return { isValid: false, error: "Top P must be a number" };
  }
  if (topP < 0 || topP > 1) {
    return { isValid: false, error: "Top P must be between 0.0 and 1.0" };
  }
  return { isValid: true };
};

/**
 * Validates top_k value (must be a positive integer)
 */
export const validateTopK = (topK: number): ValidationResult => {
  if (!Number.isInteger(topK)) {
    return { isValid: false, error: "Top K must be an integer" };
  }
  if (topK < 1) {
    return { isValid: false, error: "Top K must be greater than 0" };
  }
  return { isValid: true };
};

/**
 * Validates max_tokens value (must be a positive integer)
 */
export const validateMaxTokens = (maxTokens: number): ValidationResult => {
  if (!Number.isInteger(maxTokens)) {
    return { isValid: false, error: "Max Tokens must be an integer" };
  }
  if (maxTokens < 1) {
    return { isValid: false, error: "Max Tokens must be greater than 0" };
  }
  return { isValid: true };
};

/**
 * Validates all model settings and returns the first error found, if any.
 *
 * @param settings - The model settings to validate
 * @returns Validation result with error message if invalid
 */
export const validateModelSettings = (settings: ModelSettings): ValidationResult => {
  // Validate temperature
  const tempResult = validateTemperature(settings.temperature);
  if (!tempResult.isValid) {
    return tempResult;
  }

  // Validate topP if present
  if (settings.topP !== undefined) {
    const topPResult = validateTopP(settings.topP);
    if (!topPResult.isValid) {
      return topPResult;
    }
  }

  // Validate topK if present
  if (settings.topK !== undefined) {
    const topKResult = validateTopK(settings.topK);
    if (!topKResult.isValid) {
      return topKResult;
    }
  }

  // Validate maxTokens if present
  if (settings.maxTokens !== undefined) {
    const maxTokensResult = validateMaxTokens(settings.maxTokens);
    if (!maxTokensResult.isValid) {
      return maxTokensResult;
    }
  }

  return { isValid: true };
};

/**
 * Validates a string input for numeric values with bounds
 */
export const validateNumericInput = (
  value: string,
  min: number,
  max: number,
  fieldName: string,
  allowEmpty = false
): ValidationResult => {
  if (allowEmpty && value.trim() === "") {
    return { isValid: true };
  }

  const parsed = parseFloat(value);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }

  if (parsed < min || parsed > max) {
    return { isValid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }

  return { isValid: true };
};

/**
 * Validates a string input for integer values with bounds
 */
export const validateIntegerInput = (
  value: string,
  min: number,
  max: number,
  fieldName: string,
  allowEmpty = false
): ValidationResult => {
  if (allowEmpty && value.trim() === "") {
    return { isValid: true };
  }

  const parsed = parseInt(value);
  if (isNaN(parsed) || !Number.isInteger(parsed)) {
    return { isValid: false, error: `${fieldName} must be a valid integer` };
  }

  if (parsed < min || parsed > max) {
    return { isValid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }

  return { isValid: true };
};

/**
 * Validation service class for centralized validation logic
 */
export class ValidationService {
  /**
   * Validates model settings with detailed error reporting
   */
  static validateModelSettings(settings: ModelSettings): ValidationResult {
    return validateModelSettings(settings);
  }

  /**
   * Validates temperature input from form
   */
  static validateTemperatureInput(value: string): ValidationResult {
    return validateNumericInput(value, 0, 2, "Temperature");
  }

  /**
   * Validates top_p input from form
   */
  static validateTopPInput(value: string): ValidationResult {
    return validateNumericInput(value, 0, 1, "Top P", true);
  }

  /**
   * Validates top_k input from form
   */
  static validateTopKInput(value: string): ValidationResult {
    return validateIntegerInput(value, 1, 100, "Top K", true);
  }

  /**
   * Validates max_tokens input from form
   */
  static validateMaxTokensInput(value: string): ValidationResult {
    return validateIntegerInput(value, 1, Number.MAX_SAFE_INTEGER, "Max Tokens", true);
  }

  /**
   * Validates conversation title
   */
  static validateConversationTitle(title: string): ValidationResult {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      return { isValid: false, error: "Title cannot be empty" };
    }
    if (trimmed.length > 200) {
      return { isValid: false, error: "Title must be 200 characters or less" };
    }
    return { isValid: true };
  }

  /**
   * Validates message content
   */
  static validateMessageContent(content: string): ValidationResult {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return { isValid: false, error: "Message cannot be empty" };
    }
    if (trimmed.length > 100000) {
      return { isValid: false, error: "Message must be 100,000 characters or less" };
    }
    return { isValid: true };
  }
}

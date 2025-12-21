/**
 * Visual Feedback Module
 * Handles visual state indicators for code blocks
 */

export enum VisualState {
  Processing = "processing",
  Success = "success",
  Error = "error",
}

/**
 * Mark an element as processing (blue border)
 */
export function markVisualProcessing(element: HTMLElement) {
  if (element.dataset.mcpState === VisualState.Processing) return;

  element.dataset.mcpState = VisualState.Processing;
  element.dataset.mcpVisual = "true";
  element.style.border = "2px solid #2196F3"; // Blue
  element.style.borderRadius = "4px";
  element.style.transition = "border-color 0.3s ease";
}

/**
 * Mark an element as successful (green border)
 */
export function markVisualSuccess(element: HTMLElement) {
  if (element.dataset.mcpState === VisualState.Success) return;

  element.dataset.mcpState = VisualState.Success;
  element.dataset.mcpVisual = "true";
  element.style.border = "2px solid #00E676"; // Green
  element.style.borderRadius = "4px";
}

/**
 * Mark an element as error (red border)
 */
export function markVisualError(element: HTMLElement) {
  if (element.dataset.mcpState === VisualState.Error) return;

  element.dataset.mcpState = VisualState.Error;
  element.dataset.mcpVisual = "true";
  element.style.border = "2px solid #F44336"; // Red
  element.style.borderRadius = "4px";
}

/**
 * Clear visual state from an element
 */
export function clearVisualState(element: HTMLElement) {
  delete element.dataset.mcpState;
  delete element.dataset.mcpVisual;
  element.style.border = "none";
}

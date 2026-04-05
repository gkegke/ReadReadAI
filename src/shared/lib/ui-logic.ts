/**
 * Utility to calculate exactly what the next manual toggle state should be
 * based on the current calculated visibility.
 */
export function getNextToggleState(currentVisibility: boolean): boolean {
    return !currentVisibility;
}

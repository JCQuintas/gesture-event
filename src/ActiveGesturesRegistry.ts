/**
 * ActiveGesturesRegistry - Centralized registry for tracking which gestures are active on elements
 *
 * This singleton class keeps track of all gesture instances that are currently in their active state,
 * allowing both the system and applications to query which gestures are active on specific elements.
 */

import { Gesture } from './Gesture';

/**
 * Type for entries in the active gestures registry
 */
export type ActiveGestureEntry<GestureName extends string> = {
  /** The gesture instance that is active */
  gesture: Gesture<GestureName>;
  /** The element on which the gesture is active */
  element: HTMLElement;
};

/**
 * Singleton registry that maintains a record of all currently active gestures across elements
 */
export class ActiveGesturesRegistry<GestureName extends string> {
  /** Singleton instance reference */
  private static instance: ActiveGesturesRegistry<string> | null = null;

  /** Map of elements to their active gestures */
  private activeGestures: Map<HTMLElement, Set<ActiveGestureEntry<GestureName>>> = new Map();

  /**
   * Use ActiveGesturesRegistry.getInstance() instead
   */
  private constructor() {}

  /**
   * Get or create the singleton instance of ActiveGesturesRegistry
   *
   * @returns The singleton ActiveGesturesRegistry instance
   */
  public static getInstance(): ActiveGesturesRegistry<string> {
    if (!ActiveGesturesRegistry.instance) {
      ActiveGesturesRegistry.instance = new ActiveGesturesRegistry();
    }
    return ActiveGesturesRegistry.instance;
  }

  /**
   * Register a gesture as active on an element
   *
   * @param element - The DOM element on which the gesture is active
   * @param gesture - The gesture instance that is active
   */
  public registerActiveGesture(element: HTMLElement, gesture: Gesture<GestureName>): void {
    if (!this.activeGestures.has(element)) {
      this.activeGestures.set(element, new Set());
    }

    const elementGestures = this.activeGestures.get(element)!;
    const entry: ActiveGestureEntry<GestureName> = {
      gesture,
      element,
    };

    elementGestures.add(entry);
  }

  /**
   * Remove a gesture from the active registry
   *
   * @param element - The DOM element on which the gesture was active
   * @param gesture - The gesture instance to deactivate
   */
  public unregisterActiveGesture(element: HTMLElement, gesture: Gesture<GestureName>): void {
    const elementGestures = this.activeGestures.get(element);
    if (!elementGestures) return;

    // Find and remove the specific gesture entry
    elementGestures.forEach(entry => {
      if (entry.gesture === gesture) {
        elementGestures.delete(entry);
      }
    });

    // Remove the element from the map if it no longer has any active gestures
    if (elementGestures.size === 0) {
      this.activeGestures.delete(element);
    }
  }

  /**
   * Get all active gestures for a specific element
   *
   * @param element - The DOM element to query
   * @returns Array of active gesture names
   */
  public getActiveGestures(element: HTMLElement): Record<string, boolean> {
    const elementGestures = this.activeGestures.get(element);
    if (!elementGestures) return {} as Record<string, boolean>;

    return Array.from(elementGestures).reduce(
      (acc, entry) => {
        acc[entry.gesture.name] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );
  }

  /**
   * Check if a specific gesture is active on an element
   *
   * @param element - The DOM element to check
   * @param gesture - The gesture instance to check
   * @returns True if the gesture is active on the element, false otherwise
   */
  public isGestureActive(element: HTMLElement, gesture: Gesture<GestureName>): boolean {
    const elementGestures = this.activeGestures.get(element);
    if (!elementGestures) return false;
    return Array.from(elementGestures).some(entry => entry.gesture === gesture);
  }

  /**
   * Clear all active gestures from the registry
   */
  public destroy(): void {
    this.activeGestures.clear();
  }

  /**
   * Clear all active gestures for a specific element
   *
   * @param element - The DOM element to clear
   */
  public unregisterElement(element: HTMLElement): void {
    this.activeGestures.delete(element);
  }
}

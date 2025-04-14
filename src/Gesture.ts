/**
 * Base Gesture module that provides common functionality for all gesture implementations
 */

import { ActiveGesturesRegistry } from './ActiveGesturesRegistry';
import { PointerData, PointerManager } from './PointerManager';
import { CustomEventListener } from './types/CustomEventListener';

/**
 * The possible phases of a gesture during its lifecycle.
 *
 * - 'start': The gesture has been recognized and is beginning
 * - 'ongoing': The gesture is in progress (e.g., a finger is moving)
 * - 'end': The gesture has completed successfully
 * - 'cancel': The gesture was interrupted or terminated abnormally
 */
export type GesturePhase = 'start' | 'ongoing' | 'end' | 'cancel';

/**
 * Core data structure passed to gesture event handlers.
 * Contains all relevant information about a gesture event.
 */
export type GestureEventData = {
  /** The centroid of all active pointers involved in the gesture */
  centroid: { x: number; y: number };
  /** The target element of the original event */
  target: EventTarget | null;
  /** The original event that triggered this gesture */
  srcEvent: Event;
  /** The current phase of the gesture */
  phase: GesturePhase;
  /** Array of all active pointers involved in the gesture */
  pointers: PointerData[];
  /** The time at which the gesture event occurred */
  timeStamp: number;
  /** List of all currently active gestures */
  activeGestures: Record<string, boolean>;
};

/**
 * Configuration options for creating a gesture instance.
 */
export type GestureOptions<GestureName extends string> = {
  /** Unique name identifying this gesture type */
  name: GestureName;
  /** Whether to prevent default browser action for gesture events */
  preventDefault?: boolean;
  /** Whether to stop propagation of gesture events */
  stopPropagation?: boolean;
  // Hard to correctly type this, so we just use string[]
  /**
   * List of gesture names that should prevent this gesture from activating when they are active.
   * If any of these gestures are active, this gesture will not be recognized.
   *
   * This only works when the gestures in the array have phases. Because `TurnWheel` and `Tap`
   * gestures are single-phase, they will not be able to prevent other gestures.
   *
   * @example ['pan', 'pinch']
   * @default [] (no prevented gestures)
   */
  preventIf?: string[];
};

declare const _privateKey: unique symbol;

/**
 * Type for the state of a gesture recognizer.
 */
export type GestureState = {
  [_privateKey]?: undefined;
};

/**
 * Base abstract class for all gestures. This class provides the fundamental structure
 * and functionality for handling gestures, including registering and unregistering
 * gesture handlers, creating emitters, and managing gesture state.
 *
 * Gesture is designed as an extensible base for implementing specific gesture recognizers.
 * Concrete gesture implementations should extend this class or one of its subclasses.
 *
 * To implement:
 * - Non-pointer gestures (like wheel events): extend this Gesture class directly
 * - Pointer-based gestures: extend the PointerGesture class instead
 *
 * @example
 * ```ts
 * import { Gesture } from './Gesture';
 *
 * class CustomGesture extends Gesture {
 *   constructor(options) {
 *     super(options);
 *   }
 *
 *   clone(overrides) {
 *     return new CustomGesture({
 *       name: this.name,
 *       // ... other options
 *       ...overrides,
 *     });
 *   }
 * }
 * ```
 */
export abstract class Gesture<GestureName extends string> {
  /** Unique name identifying this gesture type */
  public readonly name: GestureName;

  /** Whether to prevent default browser action for gesture events */
  protected preventDefault: boolean;

  /** Whether to stop propagation of gesture events */
  protected stopPropagation: boolean;

  /**
   * List of gesture names that should prevent this gesture from activating when they are active.
   */
  protected preventIf: string[];

  /** Reference to the singleton PointerManager instance */
  protected pointerManager!: PointerManager;

  /** Reference to the singleton ActiveGesturesRegistry instance */
  protected gesturesRegistry!: ActiveGesturesRegistry<GestureName>;

  /** The DOM element this gesture is attached to */
  protected element!: HTMLElement;

  /** Stores the active gesture state */
  protected abstract state: GestureState;

  /** @internal For types. If false enables phases (xStart, x, xEnd) */
  protected abstract readonly isSinglePhase: boolean;

  /** @internal For types. The event type this gesture is associated with */
  protected abstract readonly eventType: CustomEvent;

  /** @internal For types. The options type for this gesture */
  protected abstract readonly optionsType: GestureOptions<GestureName>;

  /**
   * Create a new gesture instance with the specified options
   *
   * @param options - Configuration options for this gesture
   */
  constructor(options: GestureOptions<GestureName>) {
    this.name = options.name;
    this.preventDefault = options.preventDefault ?? false;
    this.stopPropagation = options.stopPropagation ?? false;
    this.preventIf = options.preventIf ?? [];
  }

  /**
   * Initialize the gesture by acquiring the pointer manager singleton
   * Must be called before the gesture can be used
   */
  public init(element: HTMLElement): void {
    this.element = element;

    if (!this.pointerManager) {
      this.pointerManager = PointerManager.getInstance();
    }

    if (!this.gesturesRegistry) {
      this.gesturesRegistry =
        ActiveGesturesRegistry.getInstance() as ActiveGesturesRegistry<GestureName>;
    }

    const changeOptionsEventName = `${this.name}ChangeOptions`;
    (this.element as CustomEventListener).addEventListener(
      changeOptionsEventName,
      this.handleOptionsChange.bind(this)
    );
  }

  /**
   * Handle option change events
   * @param event Custom event with new options in the detail property
   */
  protected handleOptionsChange(event: CustomEvent<Omit<typeof this.optionsType, 'name'>>): void {
    if (event && event.detail) {
      this.updateOptions(event.detail);
    }
  }

  /**
   * Update the gesture options with new values
   * @param options Object containing properties to update
   */
  protected updateOptions(options: Omit<typeof this.optionsType, 'name'>): void {
    // Update common options
    this.preventDefault = options.preventDefault ?? this.preventDefault;
    this.stopPropagation = options.stopPropagation ?? this.stopPropagation;
    this.preventIf = options.preventIf ?? this.preventIf;
  }

  /**
   * Create a deep clone of this gesture for a new element
   *
   * @param overrides - Optional configuration options that override the defaults
   * @returns A new instance of this gesture with the same configuration and any overrides applied
   */
  public abstract clone(overrides?: Record<string, unknown>): Gesture<GestureName>;

  /**
   * Check if the event's target is or is contained within any of our registered elements
   *
   * @param event - The browser event to check
   * @returns The matching element or null if no match is found
   */
  protected getTargetElement(event: Event): HTMLElement | null {
    if (this.element === event.target || this.element.contains(event.target as Node)) {
      return this.element;
    }
    return null;
  }

  /** Whether the gesture is currently active */
  set isActive(isActive: boolean) {
    if (isActive) {
      this.gesturesRegistry.registerActiveGesture(this.element, this);
    } else {
      this.gesturesRegistry.unregisterActiveGesture(this.element, this);
    }
  }

  /** Whether the gesture is currently active */
  get isActive(): boolean {
    return this.gesturesRegistry.isGestureActive(this.element, this) ?? false;
  }

  /**
   * Checks if this gesture should be prevented from activating.
   *
   * @param element - The DOM element to check against
   * @returns true if the gesture should be prevented, false otherwise
   */
  protected shouldPreventGesture(element: HTMLElement): boolean {
    if (this.preventIf.length === 0) {
      return false; // No prevention rules, allow the gesture
    }

    const activeGestures = this.gesturesRegistry.getActiveGestures(element);

    // Check if any of the gestures that would prevent this one are active
    return this.preventIf.some(gestureName => activeGestures[gestureName]);
  }

  /**
   * Clean up the gesture and unregister any listeners
   * Call this method when the gesture is no longer needed to prevent memory leaks
   */
  public destroy(): void {
    const changeOptionsEventName = `${this.name}ChangeOptions`;
    (this.element as CustomEventListener).removeEventListener(
      changeOptionsEventName,
      this.handleOptionsChange.bind(this)
    );
  }

  /**
   * Reset the gesture state to its initial values
   */
  protected abstract resetState(): void;
}

/**
 * PanGesture - Detects panning (dragging) movements
 *
 * This gesture tracks pointer dragging movements across elements, firing events when:
 * - The drag movement begins and passes the threshold distance (start)
 * - The drag movement continues (ongoing)
 * - The drag movement ends (end)
 *
 * The gesture can be configured to recognize movement only in specific directions.
 */

import { GestureEventData, GesturePhase, GestureState } from '../Gesture';
import { PointerGesture, PointerGestureOptions } from '../PointerGesture';
import { PointerData } from '../PointerManager';
import { InternalEvent } from '../types';
import { calculateCentroid, createEventName, getDirection, isDirectionAllowed } from '../utils';

/**
 * Configuration options for PanGesture
 * Extends PointerGestureOptions with direction constraints
 */
export type PanGestureOptions<Name extends string> = PointerGestureOptions<Name> & {
  /**
   * Optional array of allowed directions for the pan gesture
   * If not specified, all directions are allowed
   */
  direction?: Array<'up' | 'down' | 'left' | 'right'>;
};

/**
 * Event data specific to pan gesture events
 * Contains information about movement distance, direction, and velocity
 */
export type PanGestureEventData = GestureEventData & {
  /** Horizontal distance moved in pixels from the start of the current gesture */
  deltaX: number;
  /** Vertical distance moved in pixels from the start of the current gesture */
  deltaY: number;
  /** Total accumulated horizontal movement in pixels */
  totalDeltaX: number;
  /** Total accumulated vertical movement in pixels */
  totalDeltaY: number;
  /** The primary direction of movement (up, down, left, right, or null if no clear direction) */
  direction: 'up' | 'down' | 'left' | 'right' | null;
  /** Horizontal velocity in pixels per second */
  velocityX: number;
  /** Vertical velocity in pixels per second */
  velocityY: number;
  /** Total velocity magnitude in pixels per second */
  velocity: number;
  /** The original DOM pointer event that triggered this gesture event */
  srcEvent: PointerEvent;
};

/**
 * Type definition for the CustomEvent created by PanGesture
 */
export type PanEvent = CustomEvent<PanGestureEventData>;

/**
 * State tracking for the PanGesture
 */
export type PanGestureState = GestureState & {
  /** The initial centroid position when the gesture began */
  startCentroid: { x: number; y: number } | null;
  /** The most recent centroid position during the gesture */
  lastCentroid: { x: number; y: number } | null;
  /** Whether the movement threshold has been reached to activate the gesture */
  movementThresholdReached: boolean;
  /** Total accumulated horizontal delta since gesture tracking began */
  totalDeltaX: number;
  /** Total accumulated vertical delta since gesture tracking began */
  totalDeltaY: number;
};

/**
 * PanGesture class for handling panning/dragging interactions
 *
 * This gesture detects when users drag across elements with one or more pointers,
 * and dispatches directional movement events with delta and velocity information.
 */
export class PanGesture<Name extends string> extends PointerGesture<Name> {
  protected state: PanGestureState = {
    active: false,
    startPointers: new Map(),
    startCentroid: null,
    lastCentroid: null,
    movementThresholdReached: false,
    totalDeltaX: 0,
    totalDeltaY: 0,
  };

  protected readonly isSinglePhase = false as const;
  protected readonly eventType: PanEvent = {} as PanEvent;
  protected readonly optionsType: PanGestureOptions<Name> = {} as PanGestureOptions<Name>;

  /**
   * Allowed directions for the pan gesture
   * Default allows all directions
   */
  private direction: Array<'up' | 'down' | 'left' | 'right'>;

  constructor(options: PanGestureOptions<Name>) {
    super(options);
    this.direction = options.direction || ['up', 'down', 'left', 'right'];
  }

  public clone(overrides?: Record<string, unknown>): PanGesture<Name> {
    return new PanGesture({
      name: this.name,
      preventDefault: this.preventDefault,
      stopPropagation: this.stopPropagation,
      threshold: this.threshold,
      minPointers: this.minPointers,
      maxPointers: this.maxPointers,
      direction: [...this.direction],
      // Apply any overrides passed to the method
      ...overrides,
    });
  }

  public destroy(): void {
    this.resetState();
    super.destroy();
  }

  protected resetState(): void {
    this.state = {
      active: false,
      startPointers: new Map(),
      startCentroid: null,
      lastCentroid: null,
      movementThresholdReached: false,
      totalDeltaX: 0,
      totalDeltaY: 0,
    };
  }

  /**
   * Handle pointer events for the pan gesture
   */
  protected handlePointerEvent(pointers: Map<number, PointerData>, event: PointerEvent): void {
    // Check for our special forceReset flag to handle interrupted gestures (from contextmenu, blur)
    if ((event as InternalEvent).forceReset && this.element) {
      // Reset all active pan gestures when we get a force reset event
      // Cancel any active gesture with a proper cancel event

      if (this.state?.active) {
        const relevantPointers = Array.from(pointers.values());
        // Only emit if we have active state and necessary data
        if (this.state?.startCentroid && this.state.lastCentroid) {
          this.emitPanEvent(
            this.element,
            'cancel',
            relevantPointers,
            event,
            this.state.lastCentroid
          );
        }
        // Don't reset total delta values on force reset - just the active gesture state
        this.resetActiveState();
      }
      return;
    }

    const pointersArray = Array.from(pointers.values());

    // Find which element (if any) is being targeted
    const targetElement = this.getTargetElement(event);
    if (!targetElement) return;

    // Filter pointers to only include those targeting our element or its children
    const relevantPointers = pointersArray.filter(
      pointer => targetElement === pointer.target || targetElement.contains(pointer.target as Node)
    );

    // Check if we have enough pointers and not too many
    if (relevantPointers.length < this.minPointers || relevantPointers.length > this.maxPointers) {
      if (this.state.active) {
        // Cancel or end the gesture if it was active
        this.cancel(targetElement, relevantPointers, event);
      }
      return;
    }

    switch (event.type) {
      case 'pointerdown':
        if (!this.state.active && !this.state.startCentroid) {
          // Store initial pointers
          relevantPointers.forEach(pointer => {
            this.state.startPointers.set(pointer.pointerId, pointer);
          });

          // Calculate and store the starting centroid
          this.state.startCentroid = calculateCentroid(relevantPointers);
          this.state.lastCentroid = { ...this.state.startCentroid };
        }
        break;

      case 'pointermove':
        if (this.state.startCentroid && relevantPointers.length >= this.minPointers) {
          // Calculate current centroid
          const currentCentroid = calculateCentroid(relevantPointers);

          // Calculate delta from start
          const deltaX = currentCentroid.x - this.state.startCentroid.x;
          const deltaY = currentCentroid.y - this.state.startCentroid.y;

          // Calculate movement distance
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          // Determine movement direction
          const moveDirection = getDirection(this.state.startCentroid, currentCentroid);

          // Check if movement passes the threshold and is in an allowed direction
          if (
            !this.state.movementThresholdReached &&
            distance >= this.threshold &&
            isDirectionAllowed(moveDirection, this.direction)
          ) {
            this.state.movementThresholdReached = true;
            this.state.active = true;

            // Emit start event
            this.emitPanEvent(targetElement, 'start', relevantPointers, event, currentCentroid);
          }
          // If we've already crossed the threshold, continue tracking
          else if (this.state.movementThresholdReached && this.state.active) {
            // Calculate change in position since last move
            const lastDeltaX = this.state.lastCentroid
              ? currentCentroid.x - this.state.lastCentroid.x
              : 0;
            const lastDeltaY = this.state.lastCentroid
              ? currentCentroid.y - this.state.lastCentroid.y
              : 0;

            // Update total accumulated delta
            if (this.state.movementThresholdReached) {
              this.state.totalDeltaX += lastDeltaX;
              this.state.totalDeltaY += lastDeltaY;
            }

            // Emit ongoing event
            this.emitPanEvent(targetElement, 'ongoing', relevantPointers, event, currentCentroid);
          }

          // Update last centroid
          this.state.lastCentroid = currentCentroid;
        }
        break;

      case 'pointerup':
      case 'pointercancel':
        // If the gesture was active (threshold was reached), emit end event
        if (this.state.active && this.state.movementThresholdReached) {
          // If all relevant pointers are gone, end the gesture
          if (
            relevantPointers.filter(p => p.type !== 'pointerup' && p.type !== 'pointercancel')
              .length === 0
          ) {
            // End the gesture
            const currentCentroid = this.state.lastCentroid || this.state.startCentroid!;
            this.emitPanEvent(targetElement, 'end', relevantPointers, event, currentCentroid);

            // Reset active state but keep total delta values
            this.resetActiveState();
          }
        } else {
          // If threshold wasn't reached (simple click), just reset active state
          this.resetActiveState();
        }
        break;
    }
  }

  /**
   * Emit pan-specific events with additional data
   */
  private emitPanEvent(
    element: HTMLElement,
    phase: GesturePhase,
    pointers: PointerData[],
    event: PointerEvent,
    currentCentroid: { x: number; y: number }
  ): void {
    if (!this.state.startCentroid) return;

    // Calculate deltas from start position
    const deltaX = currentCentroid.x - this.state.startCentroid.x;
    const deltaY = currentCentroid.y - this.state.startCentroid.y;

    // Get direction of movement
    const direction = getDirection(this.state.startCentroid, currentCentroid);

    // Calculate velocity - time difference in seconds
    const firstPointer = this.state.startPointers.values().next().value;
    const timeElapsed = firstPointer ? (event.timeStamp - firstPointer.timeStamp) / 1000 : 0;
    const velocityX = timeElapsed > 0 ? deltaX / timeElapsed : 0;
    const velocityY = timeElapsed > 0 ? deltaY / timeElapsed : 0;
    const velocity = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

    // Create custom event data
    const customEventData: PanGestureEventData = {
      centroid: currentCentroid,
      target: event.target,
      srcEvent: event,
      phase: phase,
      pointers,
      timeStamp: event.timeStamp,
      deltaX,
      deltaY,
      direction,
      velocityX,
      velocityY,
      velocity,
      totalDeltaX: this.state.totalDeltaX,
      totalDeltaY: this.state.totalDeltaY,
    };

    // Event names to trigger
    const eventName = createEventName(this.name, phase);

    // Dispatch custom events on the element
    const domEvent = new CustomEvent(eventName, {
      bubbles: true,
      cancelable: true,
      detail: customEventData,
    });

    element.dispatchEvent(domEvent);
  }

  /**
   * Cancel the current gesture
   */
  private cancel(element: HTMLElement, pointers: PointerData[], event: PointerEvent): void {
    if (this.state.active && this.state.startCentroid && this.state.lastCentroid) {
      this.emitPanEvent(element, 'cancel', pointers, event, this.state.lastCentroid);
    }
    this.resetState();
  }

  /**
   * Reset the active gesture state for a specific element, but keep total delta values
   */
  private resetActiveState(): void {
    this.state.active = false;
    this.state.startPointers.clear();
    this.state.startCentroid = null;
    this.state.lastCentroid = null;
    this.state.movementThresholdReached = false;
  }
}

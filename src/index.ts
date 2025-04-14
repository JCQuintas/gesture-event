/**
 * Gesture Events Library
 *
 * A centralized pointer event-based gesture recognition library
 */

// Export core classes
export { Gesture } from './Gesture';
export { GestureManager } from './GestureManager';
export { PointerManager } from './PointerManager';

// Export gesture implementations
export { MoveGesture } from './gestures/MoveGesture';
export { PanGesture } from './gestures/PanGesture';
export { PinchGesture } from './gestures/PinchGesture';
export { RotateGesture } from './gestures/RotateGesture';
export { TapGesture } from './gestures/TapGesture';
export { TurnWheelGesture } from './gestures/TurnWheelGesture';

// Export types
export type { GestureEventData, GestureOptions, GesturePhase } from './Gesture';

export type { PointerData, PointerManagerOptions } from './PointerManager';

export type { GestureManagerOptions } from './GestureManager';

export type { MoveEvent, MoveGestureEventData, MoveGestureOptions } from './gestures/MoveGesture';
export type { PanEvent, PanGestureEventData, PanGestureOptions } from './gestures/PanGesture';
export type {
  PinchEvent,
  PinchGestureEventData,
  PinchGestureOptions,
} from './gestures/PinchGesture';
export type {
  RotateEvent,
  RotateGestureEventData,
  RotateGestureOptions,
} from './gestures/RotateGesture';
export type { TapEvent, TapGestureEventData, TapGestureOptions } from './gestures/TapGesture';
export type {
  TurnWheelEvent,
  TurnWheelGestureEventData,
  TurnWheelGestureOptions,
} from './gestures/TurnWheelGesture';

export type { GestureElement } from './types/GestureElement';

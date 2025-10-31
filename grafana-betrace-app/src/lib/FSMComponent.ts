/**
 * FSMComponent - Type system for finite state machine-driven React components
 *
 * Philosophy: UI components are THIN renderers for pure state machines.
 *
 * Benefits:
 * - State machines are testable without React (Jest, 1000+ tests/sec)
 * - UI is purely presentational (no business logic)
 * - DST tests business logic, not pixels
 * - Clear separation of concerns
 *
 * Pattern:
 * 1. Define state machine (pure functions)
 * 2. Create FSM component (thin adapter)
 * 3. Test state machine with Jest (fast)
 * 4. Test UI integration with Playwright (slow, sparse)
 */

import { ReactElement } from 'react';

/**
 * Pure state machine interface
 *
 * All state machines must implement this interface.
 * No side effects allowed - just (state, event) => nextState
 */
export interface StateMachine<TState, TEvent> {
  /**
   * Initial state
   */
  initial: () => TState;

  /**
   * Pure transition function: (state, event) => nextState
   */
  transition: (state: TState, event: TEvent) => TState;

  /**
   * Get valid events for current state (for DST fuzzing)
   */
  validEvents: (state: TState) => Array<TEvent['type']>;

  /**
   * Check if event is valid for current state
   */
  canTransition: (state: TState, event: TEvent) => boolean;

  /**
   * Get metadata for UI rendering decisions
   */
  metadata: (state: TState) => Record<string, any>;
}

/**
 * FSM Component interface
 *
 * Components that use state machines must implement this interface.
 * Forces clear separation between state machine and presentation.
 */
export interface FSMComponent<TState, TEvent, TProps = {}> {
  /**
   * Pure state machine (no side effects)
   */
  machine: StateMachine<TState, TEvent>;

  /**
   * React component (pure presentation)
   * Receives state + dispatch, renders UI
   */
  View: React.FC<FSMViewProps<TState, TEvent, TProps>>;

  /**
   * Optional side effect handler (for API calls, logging, etc.)
   * Called after each state transition
   */
  effects?: (state: TState, event: TEvent) => void | Promise<void>;
}

/**
 * Props passed to FSM view components
 */
export interface FSMViewProps<TState, TEvent, TProps = {}> {
  /**
   * Current state
   */
  state: TState;

  /**
   * Dispatch function to send events
   */
  dispatch: (event: TEvent) => void;

  /**
   * State metadata (for UI rendering decisions)
   */
  metadata: Record<string, any>;

  /**
   * Additional props (specific to this component)
   */
  props?: TProps;
}

/**
 * FSM Controller - React adapter for state machines
 *
 * This is the ONLY place where React hooks meet state machines.
 * Components use this, controller uses pure state machine.
 */
export interface FSMController<TState, TEvent> {
  /**
   * Current state
   */
  state: TState;

  /**
   * Dispatch event to state machine
   */
  dispatch: (event: TEvent) => void;

  /**
   * State metadata
   */
  metadata: Record<string, any>;

  /**
   * Check if event is valid
   */
  canTransition: (event: TEvent) => boolean;
}

/**
 * Helper type: Extract event type from state machine
 */
export type EventType<TEvent> = TEvent extends { type: infer T } ? T : never;

/**
 * Helper type: Extract state type from state machine
 */
export type StateType<TMachine> = TMachine extends StateMachine<infer S, any> ? S : never;

/**
 * Test helper: Generate random valid event for fuzzing
 */
export function generateRandomEvent<TState, TEvent extends { type: string }>(
  machine: StateMachine<TState, TEvent>,
  state: TState,
  rng: { choice: <T>(items: T[]) => T; boolean: () => boolean; int: (min: number, max: number) => number; uuid: () => string }
): TEvent {
  const validTypes = machine.validEvents(state);
  const eventType = rng.choice(validTypes);

  // This is a placeholder - actual implementation depends on event structure
  // Override this in your tests for specific event generation
  return { type: eventType } as TEvent;
}

/**
 * Test helper: Fuzz state machine with random events
 *
 * Returns violations found (empty array = all invariants passed)
 */
export function fuzzStateMachine<TState, TEvent extends { type: string }>(
  machine: StateMachine<TState, TEvent>,
  eventGenerator: (state: TState) => TEvent,
  invariants: Array<(state: TState) => boolean>,
  iterations: number = 1000
): Array<{ iteration: number; state: TState; event: TEvent; invariant: string }> {
  const violations: Array<{ iteration: number; state: TState; event: TEvent; invariant: string }> = [];

  let state = machine.initial();

  for (let i = 0; i < iterations; i++) {
    const event = eventGenerator(state);
    const nextState = machine.transition(state, event);

    // Check all invariants
    for (let j = 0; j < invariants.length; j++) {
      if (!invariants[j](nextState)) {
        violations.push({
          iteration: i,
          state: nextState,
          event,
          invariant: `Invariant ${j} violated`,
        });
      }
    }

    state = nextState;
  }

  return violations;
}

/**
 * DST helper: Verify state machine properties
 */
export const StateMachineInvariants = {
  /**
   * State should always be valid (no undefined/null)
   */
  stateIsValid: <TState>(state: TState): boolean => {
    return state !== undefined && state !== null;
  },

  /**
   * State should have a type field
   */
  hasStateType: <TState extends { type: string }>(state: TState): boolean => {
    return typeof state.type === 'string' && state.type.length > 0;
  },

  /**
   * State should be serializable (no functions, symbols, etc.)
   */
  stateIsSerializable: <TState>(state: TState): boolean => {
    try {
      JSON.stringify(state);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Transition should be deterministic (same state + event = same next state)
   */
  transitionIsDeterministic: <TState, TEvent>(
    machine: StateMachine<TState, TEvent>,
    state: TState,
    event: TEvent
  ): boolean => {
    const result1 = machine.transition(state, event);
    const result2 = machine.transition(state, event);
    return JSON.stringify(result1) === JSON.stringify(result2);
  },
};

/**
 * Example usage:
 *
 * ```typescript
 * // 1. Define state machine (pure functions)
 * const CounterMachine: StateMachine<CounterState, CounterEvent> = {
 *   initial: () => ({ count: 0 }),
 *   transition: (state, event) => {
 *     if (event.type === 'INCREMENT') return { count: state.count + 1 };
 *     if (event.type === 'DECREMENT') return { count: state.count - 1 };
 *     return state;
 *   },
 *   validEvents: () => ['INCREMENT', 'DECREMENT'],
 *   canTransition: () => true,
 *   metadata: (state) => ({ canDecrement: state.count > 0 }),
 * };
 *
 * // 2. Create view component (pure presentation)
 * const CounterView: React.FC<FSMViewProps<CounterState, CounterEvent>> = ({
 *   state,
 *   dispatch,
 *   metadata,
 * }) => (
 *   <div>
 *     <p>Count: {state.count}</p>
 *     <button onClick={() => dispatch({ type: 'INCREMENT' })}>+</button>
 *     <button
 *       onClick={() => dispatch({ type: 'DECREMENT' })}
 *       disabled={!metadata.canDecrement}
 *     >
 *       -
 *     </button>
 *   </div>
 * );
 *
 * // 3. Combine into FSM component
 * export const Counter: FSMComponent<CounterState, CounterEvent> = {
 *   machine: CounterMachine,
 *   View: CounterView,
 * };
 *
 * // 4. Test state machine (no React, no browser)
 * describe('CounterMachine', () => {
 *   it('should increment', () => {
 *     const state = CounterMachine.initial();
 *     const next = CounterMachine.transition(state, { type: 'INCREMENT' });
 *     expect(next.count).toBe(1);
 *   });
 *
 *   it('should fuzz 1000 transitions', () => {
 *     const violations = fuzzStateMachine(
 *       CounterMachine,
 *       (state) => ({ type: rng.choice(['INCREMENT', 'DECREMENT']) }),
 *       [
 *         (state) => state.count >= 0, // Invariant: count never negative
 *         (state) => state.count < 1000, // Invariant: count stays reasonable
 *       ],
 *       1000
 *     );
 *     expect(violations).toHaveLength(0);
 *   });
 * });
 * ```
 */

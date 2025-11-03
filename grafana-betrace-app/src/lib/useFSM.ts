/**
 * useFSM - React hook for finite state machines
 *
 * This is the ONLY React hook you need for FSM-driven components.
 * All business logic stays in pure state machines.
 */

import { useReducer, useCallback, useEffect, useMemo } from 'react';
import { StateMachine, FSMController } from './FSMComponent';

export interface UseFSMOptions<TState, TEvent extends { type: string }> {
  /**
   * Initial state (override machine.initial())
   */
  initialState?: TState;

  /**
   * Side effect handler (called after each transition)
   */
  onTransition?: (prevState: TState, nextState: TState, event: TEvent) => void | Promise<void>;

  /**
   * Sync state with URL
   */
  syncWithURL?: {
    toURL: (state: TState) => string;
    fromURL: (pathname: string, search: string) => TState;
  };

  /**
   * Enable time-travel debugging
   */
  debug?: boolean;
}

/**
 * React hook for state machines
 *
 * Usage:
 * ```tsx
 * const fsm = useFSM(MyMachine, {
 *   onTransition: (prev, next, event) => {
 *     console.log('Transition:', prev, '->', next, 'via', event);
 *   }
 * });
 *
 * return <MyView state={fsm.state} dispatch={fsm.dispatch} metadata={fsm.metadata} />;
 * ```
 */
export function useFSM<TState, TEvent extends { type: string }>(
  machine: StateMachine<TState, TEvent>,
  options: UseFSMOptions<TState, TEvent> = {}
): FSMController<TState, TEvent> {
  const { initialState, onTransition, syncWithURL, debug = false } = options;

  // State history for time-travel debugging
  const history = useMemo<Array<{ state: TState; event?: TEvent; timestamp: number }>>(
    () => [],
    []
  );

  // Get initial state
  const getInitialState = (): TState => {
    if (initialState) return initialState;

    if (syncWithURL && typeof window !== 'undefined') {
      return syncWithURL.fromURL(window.location.pathname, window.location.search);
    }

    return machine.initial();
  };

  // Reducer wraps pure state machine + side effects
  const reducer = (state: TState, event: TEvent): TState => {
    const nextState = machine.transition(state, event);

    // Record history for debugging
    if (debug) {
      history.push({ state: nextState, event, timestamp: Date.now() });
    }

    // Call side effect handler
    if (onTransition) {
      // Run async side effects without blocking render
      Promise.resolve(onTransition(state, nextState, event)).catch((err) => {
        console.error('[useFSM] Side effect error:', err);
      });
    }

    // Sync URL if enabled
    if (syncWithURL && typeof window !== 'undefined') {
      const url = syncWithURL.toURL(nextState);
      if (window.location.pathname !== url) {
        window.history.pushState({ state: nextState }, '', url);
      }
    }

    return nextState;
  };

  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  // Sync with browser back/forward
  useEffect(() => {
    if (!syncWithURL) return;

    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.state) {
        // Browser has state - use it
        dispatch({ type: 'RESTORE_STATE', state: e.state.state } as unknown as TEvent);
      } else {
        // Parse from URL
        const newState = syncWithURL.fromURL(window.location.pathname, window.location.search);
        dispatch({ type: 'RESTORE_STATE', state: newState } as unknown as TEvent);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncWithURL]);

  // Get metadata
  const metadata = useMemo(() => machine.metadata(state), [state, machine]);

  // Check if event is valid
  const canTransition = useCallback(
    (event: TEvent) => machine.canTransition(state, event),
    [state, machine]
  );

  // Debug API
  useEffect(() => {
    if (debug && typeof window !== 'undefined') {
      // Expose debug API to browser console
      (window as any).__fsmDebug = {
        state,
        history,
        machine,
        getValidEvents: () => machine.validEvents(state),
        replayHistory: () => {
          console.log('State history:');
          history.forEach((entry, i) => {
            console.log(`${i}. ${JSON.stringify(entry.state)} via ${JSON.stringify(entry.event)}`);
          });
        },
      };
    }
  }, [debug, state, history, machine]);

  return {
    state,
    dispatch,
    metadata,
    canTransition,
  };
}

/**
 * Example usage with RulesStateMachine:
 *
 * ```tsx
 * import { useFSM } from './lib/useFSM';
 * import { RulesStateMachine, RulesStateURL } from './services/RulesStateMachine';
 *
 * export const RulesPage = () => {
 *   const fsm = useFSM(RulesStateMachine, {
 *     syncWithURL: RulesStateURL,
 *     onTransition: (prev, next, event) => {
 *       console.log('[RulesPage]', event.type);
 *
 *       // Side effects (API calls, analytics, etc.)
 *       if (event.type === 'DELETE_RULE') {
 *         analytics.track('rule_deleted', { ruleId: event.ruleId });
 *       }
 *     },
 *     debug: process.env.NODE_ENV === 'development',
 *   });
 *
 *   // UI is just a renderer
 *   return <RulesView state={fsm.state} dispatch={fsm.dispatch} metadata={fsm.metadata} />;
 * };
 * ```
 */

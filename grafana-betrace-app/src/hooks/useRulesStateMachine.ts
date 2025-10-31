/**
 * useRulesStateMachine - React adapter for pure state machine
 *
 * This is the ONLY place where React meets the state machine.
 * Components use this hook, hook uses pure state machine.
 *
 * Thin adapter: just useState + dispatch wrapper.
 */

import { useReducer, useCallback, useEffect } from 'react';
import { RulesStateMachine, RulesState, RulesEvent, RulesStateURL } from '../services/RulesStateMachine';

interface UseRulesStateMachineOptions {
  /**
   * Sync state with URL (browser history)
   */
  syncWithURL?: boolean;

  /**
   * Initial state (override default)
   */
  initialState?: RulesState;

  /**
   * Callback when state changes
   */
  onChange?: (state: RulesState, event: RulesEvent) => void;
}

export const useRulesStateMachine = (options: UseRulesStateMachineOptions = {}) => {
  const { syncWithURL = true, initialState, onChange } = options;

  // Get initial state from URL or use default
  const getInitialState = (): RulesState => {
    if (initialState) return initialState;

    if (syncWithURL && typeof window !== 'undefined') {
      return RulesStateURL.fromURL(window.location.pathname, window.location.search);
    }

    return RulesStateMachine.initial();
  };

  // Reducer wraps pure state machine
  const reducer = (state: RulesState, event: RulesEvent): RulesState => {
    const nextState = RulesStateMachine.transition(state, event);

    // Sync URL if enabled
    if (syncWithURL && typeof window !== 'undefined') {
      const url = RulesStateURL.toURL(nextState);
      if (window.location.pathname !== url) {
        window.history.pushState({}, '', url);
      }
    }

    // Call onChange callback
    if (onChange) {
      onChange(nextState, event);
    }

    return nextState;
  };

  const [state, dispatch] = useReducer(reducer, undefined, getInitialState);

  // Sync with browser back/forward
  useEffect(() => {
    if (!syncWithURL) return;

    const handlePopState = () => {
      const newState = RulesStateURL.fromURL(window.location.pathname, window.location.search);
      // Force update state to match URL
      // This is a bit hacky, but works for browser back/forward
      dispatch({ type: 'CANCEL' }); // Reset to list
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncWithURL]);

  // Helper functions (convenience wrappers around dispatch)
  const actions = {
    createRule: useCallback(() => dispatch({ type: 'CREATE_RULE' }), []),

    editRule: useCallback((ruleId: string) => dispatch({ type: 'EDIT_RULE', ruleId }), []),

    viewRule: useCallback((ruleId: string) => dispatch({ type: 'VIEW_RULE', ruleId }), []),

    saveSuccess: useCallback(() => dispatch({ type: 'SAVE_SUCCESS' }), []),

    cancel: useCallback(() => dispatch({ type: 'CANCEL' }), []),

    deleteRule: useCallback((ruleId: string) => dispatch({ type: 'DELETE_RULE', ruleId }), []),

    selectRule: useCallback(
      (ruleId: string, multi: boolean = false) => dispatch({ type: 'SELECT_RULE', ruleId, multi }),
      []
    ),

    clearSelection: useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []),
  };

  // Get state metadata (for UI rendering)
  const metadata = RulesStateMachine.metadata(state);

  // Check if event is valid (for UI disabling)
  const canTransition = useCallback(
    (event: RulesEvent) => RulesStateMachine.canTransition(state, event),
    [state]
  );

  return {
    state,
    dispatch,
    actions,
    metadata,
    canTransition,
  };
};

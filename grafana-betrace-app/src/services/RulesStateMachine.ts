/**
 * RulesStateMachine - Pure state machine for Rules UI
 *
 * This is a pure state machine with no side effects:
 * - No React dependencies
 * - No HTTP calls
 * - No DOM access
 * - Fully testable with Jest (1000+ seeds in seconds)
 *
 * Philosophy: UI is just a renderer for the state machine.
 * All business logic lives here, components are thin wrappers.
 */

import { Rule } from './BeTraceService';

/**
 * All possible UI states
 */
export type RulesState =
  | { type: 'list'; selectedIds: string[] }
  | { type: 'create' }
  | { type: 'edit'; ruleId: string }
  | { type: 'view'; ruleId: string };

/**
 * All possible events that can trigger state transitions
 */
export type RulesEvent =
  | { type: 'CREATE_RULE' }
  | { type: 'EDIT_RULE'; ruleId: string }
  | { type: 'VIEW_RULE'; ruleId: string }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'CANCEL' }
  | { type: 'DELETE_RULE'; ruleId: string }
  | { type: 'SELECT_RULE'; ruleId: string; multi: boolean }
  | { type: 'CLEAR_SELECTION' };

/**
 * Pure state machine - no side effects
 */
export const RulesStateMachine = {
  /**
   * Initial state
   */
  initial: (): RulesState => ({ type: 'list', selectedIds: [] }),

  /**
   * Pure state transition function
   * (state, event) => nextState
   */
  transition: (state: RulesState, event: RulesEvent): RulesState => {
    switch (state.type) {
      case 'list':
        switch (event.type) {
          case 'CREATE_RULE':
            return { type: 'create' };

          case 'EDIT_RULE':
            return { type: 'edit', ruleId: event.ruleId };

          case 'VIEW_RULE':
            return { type: 'view', ruleId: event.ruleId };

          case 'SELECT_RULE':
            if (event.multi) {
              // Multi-select: toggle selection
              const selected = new Set(state.selectedIds);
              if (selected.has(event.ruleId)) {
                selected.delete(event.ruleId);
              } else {
                selected.add(event.ruleId);
              }
              return { type: 'list', selectedIds: Array.from(selected) };
            } else {
              // Single select: replace selection
              return { type: 'list', selectedIds: [event.ruleId] };
            }

          case 'CLEAR_SELECTION':
            return { type: 'list', selectedIds: [] };

          case 'DELETE_RULE':
            // Remove from selection if selected
            return {
              type: 'list',
              selectedIds: state.selectedIds.filter((id) => id !== event.ruleId),
            };

          default:
            return state;
        }

      case 'create':
      case 'edit':
      case 'view':
        switch (event.type) {
          case 'SAVE_SUCCESS':
          case 'CANCEL':
            return { type: 'list', selectedIds: [] };

          case 'EDIT_RULE':
            // Allow transitioning from view -> edit
            return { type: 'edit', ruleId: event.ruleId };

          default:
            return state;
        }
    }
  },

  /**
   * Get valid events for current state
   * Used by DST to generate only valid actions
   */
  validEvents: (state: RulesState): RulesEvent['type'][] => {
    switch (state.type) {
      case 'list':
        return ['CREATE_RULE', 'EDIT_RULE', 'VIEW_RULE', 'SELECT_RULE', 'CLEAR_SELECTION', 'DELETE_RULE'];
      case 'create':
        return ['SAVE_SUCCESS', 'CANCEL'];
      case 'edit':
        return ['SAVE_SUCCESS', 'CANCEL'];
      case 'view':
        return ['EDIT_RULE', 'CANCEL'];
    }
  },

  /**
   * Check if event is valid for current state
   */
  canTransition: (state: RulesState, event: RulesEvent): boolean => {
    const validTypes = RulesStateMachine.validEvents(state);
    return validTypes.includes(event.type);
  },

  /**
   * Get state metadata (for UI rendering decisions)
   */
  metadata: (state: RulesState) => {
    switch (state.type) {
      case 'list':
        return {
          showList: true,
          showEditor: false,
          showViewer: false,
          canCreate: true,
          canEdit: true,
          canDelete: true,
          hasSelection: state.selectedIds.length > 0,
          selectionCount: state.selectedIds.length,
        };
      case 'create':
        return {
          showList: false,
          showEditor: true,
          showViewer: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          isEditMode: false,
          hasSelection: false,
          selectionCount: 0,
        };
      case 'edit':
        return {
          showList: false,
          showEditor: true,
          showViewer: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          isEditMode: true,
          hasSelection: false,
          selectionCount: 0,
        };
      case 'view':
        return {
          showList: false,
          showEditor: false,
          showViewer: true,
          canCreate: false,
          canEdit: true,
          canDelete: false,
          hasSelection: false,
          selectionCount: 0,
        };
    }
  },
};

/**
 * URL serialization (optional, for browser history)
 */
export const RulesStateURL = {
  toURL: (state: RulesState): string => {
    switch (state.type) {
      case 'list':
        return '/rules';
      case 'create':
        return '/rules/create';
      case 'edit':
        return `/rules/edit/${state.ruleId}`;
      case 'view':
        return `/rules/view/${state.ruleId}`;
    }
  },

  fromURL: (pathname: string, search: string): RulesState => {
    const params = new URLSearchParams(search);

    if (pathname === '/rules/create') {
      return { type: 'create' };
    }

    if (pathname.startsWith('/rules/edit/')) {
      const ruleId = pathname.split('/').pop();
      return ruleId ? { type: 'edit', ruleId } : { type: 'list', selectedIds: [] };
    }

    if (pathname.startsWith('/rules/view/')) {
      const ruleId = pathname.split('/').pop();
      return ruleId ? { type: 'view', ruleId } : { type: 'list', selectedIds: [] };
    }

    return { type: 'list', selectedIds: [] };
  },
};

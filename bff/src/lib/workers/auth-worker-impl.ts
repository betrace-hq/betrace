/**
 * Authentication Worker Implementation
 *
 * This is the actual Web Worker implementation that runs in a separate thread
 * to handle authentication operations without blocking the main UI thread.
 */

import type { AuthWorkerMessage, AuthWorkerResponse } from './auth-worker';

// Import auth operations
import { processAuthOperation } from './auth-operations';

// Worker message handler
self.onmessage = async (event: MessageEvent<AuthWorkerMessage>) => {
  const message = event.data;
  let response: AuthWorkerResponse;

  try {
    // Process the authentication operation
    const result = await processAuthOperation(message.type, message.payload);

    response = {
      id: message.id,
      type: 'SUCCESS',
      payload: result,
    };
  } catch (error) {
    response = {
      id: message.id,
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown authentication error',
    };
  }

  // Send response back to main thread
  self.postMessage(response);
};

// Handle worker initialization
self.postMessage({
  id: 'worker-init',
  type: 'STATUS_UPDATE',
  payload: { status: 'initialized' },
} as AuthWorkerResponse);

// Export empty object to make this a module
export {};
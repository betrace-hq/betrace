import type { Meta, StoryObj } from '@storybook/react';
import { ErrorDisplay } from './ErrorDisplay';
import { ErrorResponse } from '../utils/errorHandling';

const meta: Meta<typeof ErrorDisplay> = {
  title: 'Components/ErrorDisplay',
  component: ErrorDisplay,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorDisplay>;

const networkError: ErrorResponse = {
  message: 'Unable to connect to BeTrace backend. Check that the backend service is running.',
  type: 'network',
  retryable: true,
};

const timeoutError: ErrorResponse = {
  message: 'Request timed out. The backend may be experiencing high load.',
  type: 'timeout',
  retryable: true,
};

const serverError503: ErrorResponse = {
  message: 'Backend service temporarily unavailable. Data will refresh automatically.',
  type: 'server',
  retryable: true,
  statusCode: 503,
};

const rateLimitError: ErrorResponse = {
  message: 'Too many requests. Please wait a moment before refreshing.',
  type: 'server',
  retryable: true,
  statusCode: 429,
};

const notFoundError: ErrorResponse = {
  message: 'Resource not found. This may be expected for new installations.',
  type: 'server',
  retryable: false,
  statusCode: 404,
};

export const NetworkError: Story = {
  args: {
    error: networkError,
    onRetry: () => {
      console.log('Retry clicked');
      alert('Retrying connection...');
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Network connection error with retry option',
      },
    },
  },
};

export const TimeoutError: Story = {
  args: {
    error: timeoutError,
    onRetry: () => {
      console.log('Retry clicked');
      alert('Retrying request...');
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Request timeout error (backend under load)',
      },
    },
  },
};

export const ServiceUnavailable: Story = {
  args: {
    error: serverError503,
    onRetry: () => {
      console.log('Retry clicked');
      alert('Retrying...');
    },
    showDetails: true,
  },
  parameters: {
    docs: {
      description: {
        story: '503 Service Unavailable with status code details',
      },
    },
  },
};

export const RateLimited: Story = {
  args: {
    error: rateLimitError,
    onRetry: () => {
      console.log('Retry clicked');
      alert('Please wait before retrying...');
    },
    showDetails: true,
  },
  parameters: {
    docs: {
      description: {
        story: '429 Rate limit error',
      },
    },
  },
};

export const NotFound: Story = {
  args: {
    error: notFoundError,
    showDetails: true,
  },
  parameters: {
    docs: {
      description: {
        story: '404 Not Found - non-retryable error',
      },
    },
  },
};

export const WithContext: Story = {
  args: {
    error: networkError,
    context: 'Dashboard Metrics',
    onRetry: () => {
      console.log('Retry clicked');
      alert('Retrying...');
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Error with custom context title',
      },
    },
  },
};

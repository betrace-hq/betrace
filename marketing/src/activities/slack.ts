import type { SlackMessage } from '../types.js';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

/**
 * Send Slack notification about blog post status
 * Skips silently if SLACK_WEBHOOK_URL is not configured
 */
export async function notifySlack(message: SlackMessage): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.log('[Slack] Skipping notification (no webhook configured)');
    console.log(`[Slack] Message: ${message.text}`);
    return;
  }

  const payload = {
    text: message.text,
    blocks: message.prUrl
      ? [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${message.text}*\n\n${getStatusEmoji(message.status)} ${getStatusText(message.status)}`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: message.status === 'draft' ? 'Review PR' : 'View PR',
                },
                url: message.prUrl,
                style: message.status === 'draft' ? 'primary' : 'default',
              },
            ],
          },
        ]
      : [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message.text,
            },
          },
        ],
  };

  console.log(`[Slack] Sending notification: ${message.text}`);

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook error: ${response.statusText}`);
  }

  console.log('[Slack] Notification sent successfully');
}

function getStatusEmoji(status?: string): string {
  switch (status) {
    case 'draft':
      return '📝';
    case 'approved':
      return '✅';
    case 'published':
      return '🎉';
    default:
      return '📬';
  }
}

function getStatusText(status?: string): string {
  switch (status) {
    case 'draft':
      return 'AI-generated draft ready for human review';
    case 'approved':
      return 'Blog post approved and merging';
    case 'published':
      return 'Blog post published successfully';
    default:
      return 'Status update';
  }
}
import { Connection, Client } from '@temporalio/client';
import { generateWeeklyBlogPost } from './workflows/blog-generator.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function run() {
  console.log('🚀 Temporal Workflow Starter\n');

  // Connect to Temporal
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const client = new Client({ connection });

  // Generate unique workflow ID
  const workflowId = `blog-post-${Date.now()}`;

  console.log(`Starting workflow: ${workflowId}`);
  console.log(`Task queue: marketing-automation\n`);

  // Start workflow
  const handle = await client.workflow.start(generateWeeklyBlogPost, {
    taskQueue: 'marketing-automation',
    workflowId,
  });

  console.log('✅ Workflow started successfully!\n');
  console.log(`Workflow ID: ${handle.workflowId}`);
  console.log(`Run ID: ${handle.firstExecutionRunId}\n`);
  console.log(`🔗 Temporal UI: http://localhost:8233/namespaces/default/workflows/${handle.workflowId}\n`);
  console.log('Monitor progress:');
  console.log(`  temporal workflow describe --workflow-id ${handle.workflowId}`);
  console.log(`  temporal workflow show --workflow-id ${handle.workflowId}\n`);
  console.log('Approve blog post (after PR review):');
  console.log(`  temporal workflow signal --workflow-id ${handle.workflowId} --name prApproved --input '"<pr-number>"'\n`);
  console.log('⏳ Workflow is now running. Check logs in worker terminal...\n');

  // Optionally wait for result (blocking)
  const shouldWait = process.argv.includes('--wait');
  if (shouldWait) {
    console.log('⏳ Waiting for workflow to complete...\n');
    try {
      const result = await handle.result();
      console.log(`✅ Workflow completed! PR URL: ${result}`);
    } catch (error) {
      console.error('❌ Workflow failed:', error);
      process.exit(1);
    }
  }
}

run().catch((err) => {
  console.error('❌ Error starting workflow:', err);
  process.exit(1);
});

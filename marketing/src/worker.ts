import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities/index.js';
import { initializeKnowledgeBase } from './activities/knowledge-base.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  console.log('🚀 Starting Temporal worker...\n');

  // Initialize RAG knowledge base before connecting
  console.log('📚 Initializing RAG knowledge base...');
  await initializeKnowledgeBase();
  console.log('✅ Knowledge base ready\n');

  // Connect to Temporal server
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  console.log(`✅ Connected to Temporal at ${process.env.TEMPORAL_ADDRESS || 'localhost:7233'}`);

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: 'marketing-automation',
    workflowsPath: join(__dirname, 'workflows'),
    activities,
  });

  console.log('📋 Task queue: marketing-automation');
  console.log('🔄 Listening for workflows...\n');
  console.log('Available workflows:');
  console.log('  - generateWeeklyBlogPost (AI blog post generator)\n');
  console.log('Registered activities:');
  console.log(`  Total: ${Object.keys(activities).length} activities`);
  Object.keys(activities).forEach((name) => {
    console.log(`  - ${name}`);
  });
  console.log('\n⏳ Worker ready. Waiting for workflow executions...\n');

  // Run worker
  await worker.run();
}

run().catch((err) => {
  console.error('❌ Worker error:', err);
  process.exit(1);
});

import { proxyActivities, sleep, setHandler, defineSignal, condition } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

// Proxy activities with 5-minute timeout and 3 retries
const {
  generateTopics,
  generateBlogPost,
  reviewBlogPost,
  improveBlogPost,
  createGitHubBranch,
  createGitHubPR,
  checkPRMerged,
  notifySlack,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 2,
  },
});

// Signal for manual approval (alternative to PR polling)
export const prApprovedSignal = defineSignal<[number]>('prApproved');

/**
 * Weekly Blog Post Generator Workflow
 *
 * Orchestrates:
 * 1. AI topic generation (Ollama llama3.1:8b)
 * 2. AI blog post generation (1,500 words)
 * 3. Multi-stage review (11 expert perspectives)
 * 4. Iterative improvement until ALL reviewers score 9/10+
 * 5. GitHub branch + file creation
 * 6. GitHub PR creation (HUMAN APPROVAL GATE)
 * 7. Wait for human approval (PR merge or signal)
 * 8. Slack notification on publish
 *
 * Quality gate: ALL 11 reviewers must score 9/10 or higher (not averaged)
 * Timeout: 2 hours maximum
 *
 * Human approval options:
 * - Option A: Merge PR manually on GitHub
 * - Option B: Send Temporal signal: temporal workflow signal <id> prApproved
 *
 * Workflow can pause for days/weeks waiting for approval.
 */
export async function generateWeeklyBlogPost(): Promise<string> {
  console.log('🤖 Starting AI Blog Post Generator workflow');
  console.log('⏱️  Timeout: 2 hours maximum');
  console.log('🎯 Quality gate: ALL 11 reviewers must score 9/10+');

  const startTime = Date.now();
  const TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  // 1. Generate 5 blog post topics with Ollama
  console.log('📝 Step 1: Generating blog post topics...');
  const topics = await generateTopics({
    model: 'llama3.1:8b',
    count: 5,
  });

  console.log(`✅ Generated ${topics.length} topics`);
  console.log(`📌 Selected topic: "${topics[0]}"`);

  // 2. Generate full blog post from first topic
  console.log('✍️  Step 2: Generating initial blog post content...');
  let blogPost = await generateBlogPost({
    model: 'llama3.1:8b',
    topic: topics[0],
    wordCount: 1500,
  });

  console.log(`✅ Generated ${blogPost.wordCount} words`);
  console.log(`📄 Filename: ${blogPost.filename}`);

  // 3. Multi-stage review process (11 expert perspectives)
  console.log('🔍 Step 3: Running multi-stage quality review (11 expert perspectives)...');

  const perspectives: Array<
    | 'technical-accuracy'
    | 'authenticity'
    | 'claims-verification'
    | 'structure-clarity'
    | 'seo-effectiveness'
    | 'marketing-impact'
    | 'security-expert'
    | 'developer-experience'
    | 'presentation-design'
    | 'storytelling'
    | 'code-quality'
  > = [
    'technical-accuracy',
    'authenticity',
    'claims-verification',
    'structure-clarity',
    'seo-effectiveness',
    'marketing-impact',
    'security-expert',
    'developer-experience',
    'presentation-design',
    'storytelling',
    'code-quality',
  ];

  let reviews = await Promise.all(
    perspectives.map((perspective) =>
      reviewBlogPost({
        model: 'llama3.1:8b',
        content: blogPost.content,
        perspective,
      })
    )
  );

  // Calculate scores - ALL reviewers must score 9+
  let avgScore = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
  let minScore = Math.min(...reviews.map((r) => r.score));
  let failingReviewers = reviews.filter((r) => r.score < 9);
  let criticalIssues = reviews.flatMap((r) => r.mustFix);
  let allRecommendations = reviews.flatMap((r) => r.recommendations);

  console.log(`📊 Review Results:`);
  reviews.forEach((r) => {
    const status = r.score >= 9 ? '✅' : '❌';
    console.log(`   ${status} ${r.perspective}: ${r.score}/10`);
  });
  console.log(`   Average: ${avgScore.toFixed(1)}/10`);
  console.log(`   Minimum: ${minScore}/10`);
  console.log(`   Failing reviewers: ${failingReviewers.length}/11`);
  console.log(`   Critical issues: ${criticalIssues.length}`);
  console.log(`   Recommendations: ${allRecommendations.length}`);

  // 4. Improvement loop (until ALL reviewers score 9+ OR timeout)
  const TARGET_SCORE = 9.0;  // ALL reviewers must meet this
  let iteration = 0;

  while (minScore < TARGET_SCORE && failingReviewers.length > 0) {
    // Check timeout
    const elapsedMs = Date.now() - startTime;
    if (elapsedMs >= TIMEOUT_MS) {
      console.log(`⏰ TIMEOUT: 2 hours elapsed. Stopping improvements.`);
      console.log(`   Final scores: ${reviews.map((r) => `${r.perspective}=${r.score}`).join(', ')}`);
      break;
    }
    iteration++;
    console.log(`🔧 Step 4.${iteration}: Improving blog post (target: ${TARGET_SCORE}/10)...`);

    const improvedPost = await improveBlogPost({
      model: 'llama3.1:8b',
      originalContent: blogPost.content,
      reviews,
      targetScore: TARGET_SCORE,
    });

    console.log(`✅ Improved draft generated (${improvedPost.wordCount} words)`);

    // Re-review improved version
    const newReviews = await Promise.all(
      perspectives.map((perspective) =>
        reviewBlogPost({
          model: 'llama3.1:8b',
          content: improvedPost.content,
          perspective,
        })
      )
    );

    const newAvgScore = newReviews.reduce((sum, r) => sum + r.score, 0) / newReviews.length;
    const newMinScore = Math.min(...newReviews.map((r) => r.score));
    const newFailingReviewers = newReviews.filter((r) => r.score < 9);
    const newCriticalIssues = newReviews.flatMap((r) => r.mustFix);

    console.log(`📊 Iteration ${iteration} Review:`);
    console.log(`   Average: ${newAvgScore.toFixed(1)}/10 (was ${avgScore.toFixed(1)})`);
    console.log(`   Minimum: ${newMinScore}/10 (was ${minScore})`);
    console.log(`   Failing reviewers: ${newFailingReviewers.length}/11 (was ${failingReviewers.length})`);
    console.log(`   Critical issues: ${newCriticalIssues.length} (was ${criticalIssues.length})`);

    // Accept if minimum score improved OR fewer failing reviewers OR fewer critical issues
    if (newMinScore > minScore || newFailingReviewers.length < failingReviewers.length || newCriticalIssues.length < criticalIssues.length) {
      blogPost = improvedPost;
      reviews = newReviews;
      avgScore = newAvgScore;
      minScore = newMinScore;
      failingReviewers = newFailingReviewers;
      criticalIssues = newCriticalIssues;
      allRecommendations = newReviews.flatMap((r) => r.recommendations);
      console.log(`✅ Improvement accepted`);

      // Show current scores
      newReviews.forEach((r) => {
        const status = r.score >= 9 ? '✅' : '❌';
        console.log(`   ${status} ${r.perspective}: ${r.score}/10`);
      });
    } else {
      console.log(`⚠️  No improvement, keeping previous version`);
      break;
    }
  }

  console.log(`✅ Final quality scores:`);
  console.log(`   Average: ${avgScore.toFixed(1)}/10`);
  console.log(`   Minimum: ${minScore}/10`);
  console.log(`   Failing reviewers: ${failingReviewers.length}/11`);
  if (minScore >= TARGET_SCORE) {
    console.log(`🎉 SUCCESS: ALL 11 reviewers scored 9/10 or higher!`);
  } else {
    console.log(`⚠️  Did not reach 9/10 on all reviewers (timeout or max iterations)`);
  }

  // 5. Create GitHub branch and commit file
  console.log('🌿 Step 5: Creating GitHub branch...');
  const branch = await createGitHubBranch({
    branchName: `blog/${blogPost.filename.replace('.md', '')}`,
    filePath: `blog/posts/${blogPost.filename}`,
    content: blogPost.content,
  });

  console.log(`✅ Branch created: ${branch.name}`);

  // 6. Create Pull Request (HUMAN APPROVAL GATE)
  console.log('🔀 Step 6: Creating GitHub PR (HUMAN APPROVAL REQUIRED)...');

  const reviewSummary = reviews.map((r) =>
    `- **${r.perspective}**: ${r.score}/10
  ${r.mustFix.length > 0 ? `  ⚠️  Must fix: ${r.mustFix.join(', ')}` : '  ✅ No critical issues'}`
  ).join('\n');

  const pr = await createGitHubPR({
    title: `Blog Draft: ${blogPost.topic}`,
    body: `## AI-Generated Blog Post Draft

**Topic:** ${blogPost.topic}
**Model:** llama3.1:8b
**Word Count:** ${blogPost.wordCount}
**Quality Score:** ${avgScore.toFixed(1)}/10
**Iterations:** ${iteration}
**Generated:** ${new Date().toISOString()}

---

### 📊 Quality Review (11 Expert Perspectives)

${reviewSummary}

**Average Score:** ${avgScore.toFixed(1)}/10
**Critical Issues Remaining:** ${criticalIssues.length}

---

### ⚠️ Human Review Required

This blog post was reviewed by 11 expert reviewers:

**Technical Excellence:**
1. **Technical Accuracy** - OpenTelemetry concepts, verifiable claims
2. **Security Expert** - Cybersecurity credibility, compliance accuracy
3. **Code Quality** - Production-ready examples, best practices

**Content Quality:**
4. **Authenticity** - Natural voice vs AI-generated
5. **Claims Verification** - Substantiated performance statements
6. **Storytelling** - Emotional resonance, relatable narratives

**Structure & Impact:**
7. **Structure & Clarity** - Logical flow, readability
8. **Presentation Design** - Narrative arc, conference-talk quality
9. **Marketing Impact** - Conversion potential, competitive positioning

**Discoverability:**
10. **SEO Effectiveness** - Keyword optimization, search rankings
11. **Developer Experience** - Implementation clarity, time-to-value

${minScore >= TARGET_SCORE ? '✅ **Passed quality gate** - ALL 11 reviewers scored 9/10+' : `⚠️  **Below quality gate** - ${failingReviewers.length} reviewers below 9/10 (${failingReviewers.map((r) => r.perspective).join(', ')})`}

**Review Checklist:**
- [ ] Technical accuracy verified
- [ ] Tone is helpful, not salesy
- [ ] Code examples are correct
- [ ] No hallucinations or false claims
- [ ] FLUO DSL syntax is valid
- [ ] Structure is clear and logical
- [ ] SEO keywords naturally integrated

**Actions:**
- ✅ **Approve:** Merge this PR to publish
- 📝 **Edit:** Make changes directly in this PR
- ❌ **Reject:** Close PR with comment

---

### Preview

See full post in: \`blog/posts/${blogPost.filename}\`

---

🤖 Generated with Temporal workflow
⏸️  Workflow paused until PR is merged or signal sent
`,
    branch: branch.name,
  });

  console.log(`✅ PR created: #${pr.number}`);
  console.log(`🔗 URL: ${pr.url}`);

  // 7. Notify Slack about new draft
  console.log('💬 Step 7: Notifying team on Slack...');
  await notifySlack({
    text: `New blog post draft ready for review! Quality: ${avgScore.toFixed(1)}/10`,
    prUrl: pr.url,
    status: 'draft',
  });

  console.log('⏸️  Step 8: Waiting for human approval...');
  console.log('   Option A: Merge PR manually on GitHub');
  console.log(`   Option B: Run: temporal workflow signal ${pr.number} prApproved`);

  // 8. Wait for human approval (signal or PR merge)
  let approved = false;
  let approvedPrNumber = 0;

  // Handle manual signal
  setHandler(prApprovedSignal, (prNumber: number) => {
    console.log(`✅ Received approval signal for PR #${prNumber}`);
    approved = true;
    approvedPrNumber = prNumber;
  });

  // Poll for PR merge (check every hour)
  while (!approved) {
    const isMerged = await checkPRMerged(pr.number);
    if (isMerged) {
      console.log(`✅ PR #${pr.number} was merged on GitHub`);
      approved = true;
      approvedPrNumber = pr.number;
      break;
    }

    // Wait 1 hour before checking again
    console.log('⏳ PR not merged yet, checking again in 1 hour...');
    await condition(() => approved, '1 hour');
  }

  // 9. Post-approval notification
  console.log('🎉 Step 9: Blog post approved! Sending notification...');
  await notifySlack({
    text: `Blog post #${approvedPrNumber} published! Final quality: ${avgScore.toFixed(1)}/10`,
    prUrl: pr.url,
    status: 'published',
  });

  console.log('✅ Workflow completed successfully!');
  return pr.url;
}

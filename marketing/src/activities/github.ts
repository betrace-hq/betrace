import { Octokit } from '@octokit/rest';
import { config } from 'dotenv';
import type {
  CreateGitHubBranchParams,
  CreateGitHubPRParams,
  GitHubBranch,
  GitHubPR,
} from '../types.js';

// Load environment variables
config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const GITHUB_REPO = process.env.GITHUB_REPO || 'fluohq/fluo';
const [owner, repo] = GITHUB_REPO.split('/');

/**
 * Create a new GitHub branch with a blog post file
 */
export async function createGitHubBranch(
  params: CreateGitHubBranchParams
): Promise<GitHubBranch> {
  console.log(`[GitHub] Creating branch: ${params.branchName}`);

  // Get default branch SHA
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: 'heads/main',
  });

  const baseSha = refData.object.sha;

  // Create new branch
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${params.branchName}`,
    sha: baseSha,
  });

  console.log(`[GitHub] Branch created from main@${baseSha.substring(0, 7)}`);

  // Create file in branch
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: params.filePath,
    message: `feat(blog): add AI-generated draft post`,
    content: Buffer.from(params.content).toString('base64'),
    branch: params.branchName,
  });

  console.log(`[GitHub] File created: ${params.filePath}`);

  return {
    name: params.branchName,
    sha: baseSha,
  };
}

/**
 * Create a GitHub Pull Request (HUMAN APPROVAL GATE)
 */
export async function createGitHubPR(
  params: CreateGitHubPRParams
): Promise<GitHubPR> {
  const base = params.base || 'main';

  console.log(`[GitHub] Creating PR: ${params.branch} → ${base}`);

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: params.title,
    body: params.body,
    head: params.branch,
    base,
  });

  console.log(`[GitHub] PR created: #${pr.number} (${pr.html_url})`);
  console.log(`[GitHub] ⚠️  HUMAN APPROVAL REQUIRED - Review and merge to publish`);

  return {
    url: pr.html_url,
    number: pr.number,
    branch: params.branch,
  };
}

/**
 * Check if a PR has been merged (for approval polling)
 */
export async function checkPRMerged(prNumber: number): Promise<boolean> {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    return pr.merged === true;
  } catch (error) {
    console.error(`[GitHub] Error checking PR #${prNumber}:`, error);
    return false;
  }
}
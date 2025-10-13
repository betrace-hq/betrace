// Shared types for marketing automation workflows

export interface BlogTopic {
  title: string;
  keyword: string;
  hook: string;
}

export interface BlogPost {
  filename: string;
  content: string;
  topic: string;
  wordCount: number;
}

export interface GitHubBranch {
  name: string;
  sha: string;
}

export interface GitHubPR {
  url: string;
  number: number;
  branch: string;
}

export interface SlackMessage {
  text: string;
  prUrl?: string;
  status?: 'draft' | 'approved' | 'published';
}

// Activity parameter types
export interface GenerateTopicsParams {
  model: string;
  count: number;
}

export interface GenerateBlogPostParams {
  model: string;
  topic: string;
  wordCount: number;
}

export interface CreateGitHubBranchParams {
  branchName: string;
  filePath: string;
  content: string;
}

export interface CreateGitHubPRParams {
  title: string;
  body: string;
  branch: string;
  base?: string;
}

export interface BlogReview {
  perspective: string;
  score: number; // 1-10
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  mustFix: string[];
  recommendations: string[]; // Specific actionable recommendations for the author
}

export interface ReviewBlogPostParams {
  model: string;
  content: string;
  perspective:
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
    | 'code-quality';
}

export interface ImproveBlogPostParams {
  model: string;
  originalContent: string;
  reviews: BlogReview[];
  targetScore: number;
}
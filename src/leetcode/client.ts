import { logger } from "../utils/logger.js";
import type { LeetCodeProblemDetails, LeetCodeSolvedProblem, LeetCodeSubmission } from "./types.js";

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";
const DEFAULT_RECENT_LIMIT = 100;

interface GraphQLErrorResponse {
  message: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLErrorResponse[];
}

interface RecentSubmissionNode {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
  statusDisplay?: string;
  lang?: string;
}

interface RecentSubmissionResponse {
  recentSubmissionList?: RecentSubmissionNode[];
}

interface RecentAcceptedResponse {
  recentAcSubmissionList?: RecentSubmissionNode[];
}

interface ProblemDetailsResponse {
  question?: {
    title: string;
    titleSlug: string;
    difficulty: string;
  } | null;
}

const recentSubmissionsQuery = `
  query recentSubmissions($username: String!, $limit: Int!) {
    recentSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
      statusDisplay
      lang
    }
  }
`;

const recentAcceptedSubmissionsQuery = `
  query recentAcceptedSubmissions($username: String!, $limit: Int!) {
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
  }
`;

const problemDetailsQuery = `
  query problemDetails($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      titleSlug
      difficulty
    }
  }
`;

async function graphqlRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      referer: "https://leetcode.com",
      "user-agent": "leetcode-discord-tracker/0.1"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`LeetCode request failed with ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as GraphQLResponse<T>;

  if (body.errors?.length) {
    throw new Error(body.errors.map((error) => error.message).join("; "));
  }

  if (!body.data) {
    throw new Error("LeetCode response did not include data");
  }

  return body.data;
}

function toSubmission(node: RecentSubmissionNode, statusOverride?: string): LeetCodeSubmission {
  return {
    submissionId: node.id,
    problemSlug: node.titleSlug,
    problemTitle: node.title,
    status: statusOverride ?? node.statusDisplay ?? "Unknown",
    language: node.lang ?? null,
    submittedAt: new Date(Number(node.timestamp) * 1000)
  };
}

export async function getRecentSubmissions(
  username: string,
  limit = DEFAULT_RECENT_LIMIT
): Promise<LeetCodeSubmission[]> {
  try {
    const data = await graphqlRequest<RecentSubmissionResponse>(recentSubmissionsQuery, {
      username,
      limit
    });

    return (data.recentSubmissionList ?? []).map((node) => toSubmission(node));
  } catch (error) {
    logger.error("Failed to fetch recent LeetCode submissions", error, { username });
    throw error;
  }
}

export async function getAcceptedSubmissions(
  username: string,
  limit = DEFAULT_RECENT_LIMIT
): Promise<LeetCodeSubmission[]> {
  const submissions = await getRecentSubmissions(username, limit);
  return submissions.filter((submission) => submission.status === "Accepted");
}

export async function getUserSolvedProblems(username: string): Promise<LeetCodeSolvedProblem[]> {
  try {
    const data = await graphqlRequest<RecentAcceptedResponse>(recentAcceptedSubmissionsQuery, {
      username,
      limit: 1000
    });

    const firstSeenBySlug = new Map<string, LeetCodeSolvedProblem>();

    for (const node of data.recentAcSubmissionList ?? []) {
      const submittedAt = new Date(Number(node.timestamp) * 1000);
      const existing = firstSeenBySlug.get(node.titleSlug);

      if (!existing || submittedAt < existing.firstSolvedAt) {
        firstSeenBySlug.set(node.titleSlug, {
          problemSlug: node.titleSlug,
          problemTitle: node.title,
          difficulty: null,
          firstSolvedAt: submittedAt
        });
      }
    }

    return [...firstSeenBySlug.values()];
  } catch (error) {
    logger.error("Failed to fetch accepted LeetCode problem history", error, { username });
    throw error;
  }
}

export async function getProblemDetails(problemSlug: string): Promise<LeetCodeProblemDetails | null> {
  try {
    const data = await graphqlRequest<ProblemDetailsResponse>(problemDetailsQuery, {
      titleSlug: problemSlug
    });

    if (!data.question) {
      return null;
    }

    return {
      problemSlug: data.question.titleSlug,
      problemTitle: data.question.title,
      difficulty: data.question.difficulty
    };
  } catch (error) {
    logger.error("Failed to fetch LeetCode problem details", error, { problemSlug });
    return null;
  }
}

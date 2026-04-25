import { logger } from "../utils/logger.js";
import type { LeetCodeProblemDetails, LeetCodeSolvedProblem, LeetCodeSubmission } from "./types.js";

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";
const LEETCODE_HOME_URL = "https://leetcode.com";
const DEFAULT_RECENT_LIMIT = 100;
const SOLVED_HISTORY_PAGE_SIZE = 100;
let cachedCsrfToken: string | null = null;

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

interface UserStatusResponse {
  userStatus: {
    isSignedIn: boolean;
    username: string;
  };
}

interface SolvedQuestionsInfoResponse {
  solvedQuestionsInfo: {
    totalNum: number;
    data: Array<{
      lastAcSession?: {
        time?: string | null;
      } | null;
      question: {
        title: string;
        titleSlug: string;
        difficulty?: string | null;
      };
    }>;
  };
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

const userStatusQuery = `
  query userStatus {
    userStatus {
      isSignedIn
      username
    }
  }
`;

const solvedQuestionsInfoQuery = `
  query solvedQuestionsInfo($pageNo: Int!, $numPerPage: Int!) {
    solvedQuestionsInfo(pageNo: $pageNo, numPerPage: $numPerPage, filters: {}) {
      totalNum
      data {
        lastAcSession {
          time
        }
        question {
          title
          titleSlug
          difficulty
        }
      }
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

function extractCsrfToken(setCookieHeader: string | null): string | null {
  return setCookieHeader?.match(/csrftoken=([^;]+)/)?.[1] ?? null;
}

function getLeetCodeSessionCookie(): string | null {
  return process.env.LEETCODE_SESSION?.trim() || null;
}

function getConfiguredLeetCodeUsername(): string | null {
  return process.env.LEETCODE_USERNAME?.trim().toLowerCase() || null;
}

function buildCookieHeader(csrfToken: string): string {
  const sessionCookie = getLeetCodeSessionCookie();
  const cookies = [`csrftoken=${csrfToken}`];

  if (sessionCookie) {
    cookies.push(`LEETCODE_SESSION=${sessionCookie}`);
  }

  return cookies.join("; ");
}

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  if (process.env.LEETCODE_CSRF_TOKEN?.trim()) {
    cachedCsrfToken = process.env.LEETCODE_CSRF_TOKEN.trim();
    return cachedCsrfToken;
  }

  const sessionCookie = getLeetCodeSessionCookie();
  const response = await fetch(LEETCODE_HOME_URL, {
    headers: {
      ...(sessionCookie ? { cookie: `LEETCODE_SESSION=${sessionCookie}` } : {}),
      "user-agent": "leetcode-discord-tracker/0.1"
    }
  });
  const csrfToken = extractCsrfToken(response.headers.get("set-cookie"));

  if (!csrfToken) {
    throw new Error("LeetCode did not provide a CSRF token");
  }

  cachedCsrfToken = csrfToken;
  return csrfToken;
}

async function sendGraphqlRequest(query: string, variables: Record<string, unknown>): Promise<Response> {
  const csrfToken = await getCsrfToken();

  return fetch(LEETCODE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      referer: "https://leetcode.com",
      cookie: buildCookieHeader(csrfToken),
      "x-csrftoken": csrfToken,
      "user-agent": "leetcode-discord-tracker/0.1"
    },
    body: JSON.stringify({ query, variables })
  });
}

async function graphqlRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  let response = await sendGraphqlRequest(query, variables);

  if (response.status === 403 || response.status === 499) {
    cachedCsrfToken = null;
    response = await sendGraphqlRequest(query, variables);
  }

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`LeetCode request failed with ${response.status} ${response.statusText}: ${responseBody}`);
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

export function hasUsableSubmissionId(submissionId: string): boolean {
  return submissionId.trim() !== "" && submissionId !== "0";
}

function hasAuthenticatedSolvedHistoryFor(username: string): boolean {
  return Boolean(getLeetCodeSessionCookie() && getConfiguredLeetCodeUsername() === username.trim().toLowerCase());
}

async function getLeetCodeAuthStatus(): Promise<UserStatusResponse["userStatus"]> {
  const data = await graphqlRequest<UserStatusResponse>(userStatusQuery, {});
  return data.userStatus;
}

async function getRecentAcceptedSolvedProblems(username: string): Promise<LeetCodeSolvedProblem[]> {
  const acceptedSubmissions = await getAcceptedSubmissions(username, 100);
  const solvedProblems = new Map<string, LeetCodeSolvedProblem>();

  for (const submission of acceptedSubmissions) {
    const existing = solvedProblems.get(submission.problemSlug);

    if (!existing || submission.submittedAt < existing.firstSolvedAt) {
      solvedProblems.set(submission.problemSlug, {
        problemSlug: submission.problemSlug,
        problemTitle: submission.problemTitle,
        difficulty: null,
        firstSolvedAt: submission.submittedAt
      });
    }
  }

  return [...solvedProblems.values()];
}

function toSubmission(node: RecentSubmissionNode): LeetCodeSubmission {
  return {
    submissionId: node.id,
    problemSlug: node.titleSlug,
    problemTitle: node.title,
    status: node.statusDisplay ?? "Unknown",
    language: node.lang ?? null,
    submittedAt: new Date(Number(node.timestamp) * 1000)
  };
}

function toLeetCodeDate(timestamp: string | null | undefined): Date {
  if (!timestamp) {
    return new Date(0);
  }

  const numericTimestamp = Number(timestamp);

  if (Number.isFinite(numericTimestamp)) {
    return new Date(numericTimestamp * 1000);
  }

  const parsedDate = new Date(timestamp);
  return Number.isNaN(parsedDate.getTime()) ? new Date(0) : parsedDate;
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

    return (data.recentSubmissionList ?? [])
      .map((node) => toSubmission(node))
      .filter((submission) => {
        if (hasUsableSubmissionId(submission.submissionId)) {
          return true;
        }

        logger.warn("Ignoring LeetCode submission without a usable submission ID", {
          username,
          problemSlug: submission.problemSlug,
          submissionId: submission.submissionId
        });
        return false;
      });
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
  if (!hasAuthenticatedSolvedHistoryFor(username)) {
    logger.info("Using public recent accepted submissions for LeetCode solved problem seed", {
      username,
      reason: "authenticated history is not configured for this username"
    });
    return getRecentAcceptedSolvedProblems(username);
  }

  try {
    const authStatus = await getLeetCodeAuthStatus();
    const authenticatedUsername = authStatus.username.toLowerCase();

    if (!authStatus.isSignedIn) {
      logger.warn("LeetCode authenticated history is configured, but LeetCode says the session is not signed in; falling back to public recent submissions", {
        username,
        configuredLeetCodeUsername: getConfiguredLeetCodeUsername(),
        hasLeetCodeSession: Boolean(getLeetCodeSessionCookie()),
        hasLeetCodeCsrfToken: Boolean(process.env.LEETCODE_CSRF_TOKEN?.trim())
      });
      return getRecentAcceptedSolvedProblems(username);
    }

    if (authenticatedUsername !== username.trim().toLowerCase()) {
      logger.warn("LeetCode authenticated history is configured for a different signed-in user; falling back to public recent submissions", {
        requestedUsername: username,
        signedInUsername: authStatus.username,
        configuredLeetCodeUsername: getConfiguredLeetCodeUsername()
      });
      return getRecentAcceptedSolvedProblems(username);
    }

    const solvedProblems: LeetCodeSolvedProblem[] = [];
    let pageNo = 1;
    let total = Number.POSITIVE_INFINITY;

    while (solvedProblems.length < total) {
      const data = await graphqlRequest<SolvedQuestionsInfoResponse>(solvedQuestionsInfoQuery, {
        pageNo,
        numPerPage: SOLVED_HISTORY_PAGE_SIZE
      });
      const page = data.solvedQuestionsInfo;

      total = page.totalNum;
      solvedProblems.push(
        ...page.data.map((item) => ({
          problemSlug: item.question.titleSlug,
          problemTitle: item.question.title,
          difficulty: item.question.difficulty ?? null,
          firstSolvedAt: toLeetCodeDate(item.lastAcSession?.time)
        }))
      );

      if (page.data.length === 0) {
        break;
      }

      pageNo += 1;
    }

    logger.info("Fetched authenticated LeetCode solved problem history", {
      username,
      solvedProblemCount: solvedProblems.length
    });

    return solvedProblems;
  } catch (error) {
    logger.error("Failed to fetch authenticated LeetCode solved problem history; falling back to public recent submissions", error, {
      username
    });
    return getRecentAcceptedSolvedProblems(username);
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

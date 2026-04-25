export interface LeetCodeSubmission {
  submissionId: string;
  problemSlug: string;
  problemTitle: string;
  status: string;
  language: string | null;
  submittedAt: Date;
}

export interface LeetCodeSolvedProblem {
  problemSlug: string;
  problemTitle: string;
  difficulty: string | null;
  firstSolvedAt: Date;
}

export interface LeetCodeProblemDetails {
  problemSlug: string;
  problemTitle: string;
  difficulty: string | null;
}

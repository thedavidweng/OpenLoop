const GITHUB_ISSUES_BASE = "https://github.com/thedavidweng/OpenLoop/issues/new";

const ERROR_HELP_MAP: Record<string, { title: string; url: string }> = {
  BACKEND_START_FAILED: {
    title: "Backend failed to start",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=backend`,
  },
  BACKEND_HEALTH_TIMEOUT: {
    title: "Backend health check timed out",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=backend`,
  },
  MODEL_NOT_FOUND: {
    title: "Model not found",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=model`,
  },
  MODEL_DOWNLOAD_FAILED: {
    title: "Model download failed",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=model`,
  },
  TASK_SUBMIT_FAILED: {
    title: "Task submission failed",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=generation`,
  },
  TASK_FAILED: {
    title: "Generation task failed",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=generation`,
  },
  AUDIO_DOWNLOAD_FAILED: {
    title: "Audio download failed",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=generation`,
  },
  OUTPUT_WRITE_FAILED: {
    title: "Output write failed",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=filesystem`,
  },
  OUTPUT_READ_FAILED: {
    title: "Output read failed",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=filesystem`,
  },
  DB_WRITE_FAILED: {
    title: "Database write failed",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=db`,
  },
  DB_READ_FAILED: {
    title: "Database read failed",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=db`,
  },
  VALIDATION_FAILED: {
    title: "Validation failed",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=ux`,
  },
  MODEL_REQUIRED: {
    title: "Model required",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=model`,
  },
  GENERATION_FAILED: {
    title: "Generation failed",
    url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=generation`,
  },
};

const DEFAULT_HELP: { title: string; url: string } = {
  title: "Report an issue",
  url: `${GITHUB_ISSUES_BASE}?template=bug_report.md&labels=bug`,
};

/**
 * Get a help suggestion for a given error code.
 */
export function getErrorHelp(code: string): { title: string; url: string } {
  return ERROR_HELP_MAP[code] ?? DEFAULT_HELP;
}

/**
 * Build a GitHub issue URL pre-filled with error details.
 */
export function buildGitHubIssueUrl(error: {
  code: string;
  message: string;
  details?: string;
}): string {
  const body = [
    "## Bug Report",
    "",
    `**Error Code:** ${error.code}`,
    `**Message:** ${error.message}`,
    ...(error.details ? [`**Details:** ${error.details}`] : []),
    "",
    "### Steps to reproduce",
    "",
    "### Environment",
  ].join("\n");

  const params = new URLSearchParams({
    template: "bug_report.md",
    labels: "bug",
    body,
  });

  return `${GITHUB_ISSUES_BASE}?${params.toString()}`;
}

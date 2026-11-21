/**
 * Builds the orchestrator prompt for one pull request.
 * Final output must match ReviewReportSchema in src/types/report-types.ts.
 */
export function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `You are the code review orchestrator. Review pull request #${prNumber} in ${owner}/${repo} by coordinating three specialist subagents, then return one consolidated review report.

## Step 1: Fetch the pull request
- Use mcp__github__get_pull_request with owner "${owner}", repo "${repo}", pull_number ${prNumber} to get the title, base branch, and head commit SHA.
- Use mcp__github__get_pull_request_files with the same arguments to list changed files.
- Keep files whose status is "added" or "modified" and whose path ends in .js, .jsx, .ts, .tsx, .mjs, or .cjs.
- Skip removed files, lockfiles, generated files, and binary files.
- If no files remain, return a report with totalFiles 0, empty arrays, and a summary that says no reviewable files changed.

## Step 2: Run the subagents
For each remaining file, invoke all three subagents. Pass the file path and the PR head commit SHA so every subagent reads the same version of the code:
- Use the code-quality-analyzer agent to analyze <file> at commit <sha>
- Use the test-coverage-analyzer agent to analyze <file> at commit <sha>
- Use the refactoring-suggester agent to analyze <file> at commit <sha>

Run the subagents in parallel. Issue all Task calls for all files in a single message rather than one at a time. Each analysis is independent, so waiting between them adds time without adding safety.

## Step 3: Handle failures
- Each subagent must return only a JSON object. If one returns text that is not valid JSON, or fails, retry that subagent once.
- If it still fails, do not stop the review. Record that section for the file with empty arrays, scores of 0, and a summary that starts with "Analysis failed:" followed by the reason.
- Never fabricate subagent results.

## Step 4: Aggregate into the report
Build the final report from the subagent JSON:
- fileReviews: one entry per file, with codeQuality, testCoverage, and refactorings copied from the subagent results.
- summary:
  - totalFiles: number of files analyzed
  - overallScore: rounded average of the codeQuality overallScore values
  - criticalIssues: count of codeQuality issues with severity "critical"
  - highPriorityTests: count of untestedPaths with priority "critical" or "high"
  - refactoringOpportunities: total number of refactoring suggestions
- recommendations: up to 10 items, ordered by priority. Each one has priority, category (for example "security" or "test-coverage"), a one-sentence description, and the files it applies to. Map the subagent severities and priorities as follows: critical stays critical, high stays high, medium stays medium, and low or info becomes low.
- metadata:
  - analyzedAt: current time as an ISO 8601 string
  - duration: 0
  - agentVersions: {"code-quality-analyzer": "1.0.0", "test-coverage-analyzer": "1.0.0", "refactoring-suggester": "1.0.0"}

## Output
Return the ReviewReport as structured output. Include only the report, with no commentary.`;
}

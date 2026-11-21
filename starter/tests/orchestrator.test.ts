import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeReviewOrchestrator } from '../src/orchestrator';
import { RateLimiter, DEFAULT_RATE_LIMITS } from '../src/utils/rate-limiter';
import { ReviewError, ErrorCodes } from '../src/utils/error-handler';
import { ReviewReportJSONSchema } from '../src/types/report-types';
import { mcpServersConfig } from '../src/config/mcp.config.js';
import type { ReviewReport } from '../src/types/report-types';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/** Mimics the SDK's query() stream: an async iterable of messages. */
function streamOf(messages: unknown[]) {
  return (async function* () {
    yield* messages;
  })();
}

const successMessage = (structured_output: unknown) => ({
  type: 'result',
  subtype: 'success',
  structured_output,
});

/** Reads the private limiter so tests can check the configured limits. */
function rateLimiterOf(orchestrator: CodeReviewOrchestrator): RateLimiter {
  return (orchestrator as unknown as { rateLimiter: RateLimiter }).rateLimiter;
}

const validReport: ReviewReport = {
  pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 7 },
  fileReviews: [
    {
      file: 'src/math.ts',
      codeQuality: {
        file: 'src/math.ts',
        issues: [
          {
            line: 4,
            severity: 'critical',
            category: 'bug-risk',
            description: 'Division by zero is not guarded.',
            suggestion: 'Return early when the divisor is 0.',
          },
        ],
        overallScore: 60,
        summary: 'Needs a guard clause.',
      },
      testCoverage: {
        file: 'src/math.ts',
        hasTests: false,
        testFiles: [],
        untestedPaths: [
          {
            type: 'branch',
            location: 'divide:4',
            priority: 'critical',
            reasoning: 'Zero divisor path is untested.',
            suggestedTest: 'divide returns an error for 0',
          },
        ],
        coverageEstimate: 10,
        summary: 'No tests found.',
      },
      refactorings: {
        file: 'src/math.ts',
        suggestions: [],
        summary: 'Nothing notable.',
      },
    },
  ],
  summary: {
    totalFiles: 1,
    overallScore: 60,
    criticalIssues: 1,
    highPriorityTests: 1,
    refactoringOpportunities: 0,
  },
  recommendations: [
    {
      priority: 'critical',
      category: 'bug-risk',
      description: 'Guard against a zero divisor in divide().',
      files: ['src/math.ts'],
    },
  ],
  metadata: {
    analyzedAt: '2000-01-01T00:00:00.000Z',
    duration: 0,
    agentVersions: {
      'code-quality-analyzer': '1.0.0',
      'test-coverage-analyzer': '1.0.0',
      'refactoring-suggester': '1.0.0',
    },
  },
};

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const status = rateLimiterOf(new CodeReviewOrchestrator()).getStatus();

      expect(status.availableRequests).toBe(DEFAULT_RATE_LIMITS.maxRequestsPerMinute);
      expect(status.availableTokens).toBe(DEFAULT_RATE_LIMITS.maxTokensPerMinute);
    });

    it('should accept custom rate limit configuration', () => {
      const orchestrator = new CodeReviewOrchestrator({
        rateLimitConfig: { maxConcurrent: 1, maxRequestsPerMinute: 5, maxTokensPerMinute: 2000 },
      });

      const status = rateLimiterOf(orchestrator).getStatus();
      expect(status.availableRequests).toBe(5);
      expect(status.availableTokens).toBe(2000);
    });
  });

  describe('reviewPullRequest', () => {
    it('should fetch PR files from GitHub MCP', async () => {
      queryMock.mockReturnValue(streamOf([successMessage(validReport)]));

      await new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 7);

      expect(queryMock).toHaveBeenCalledTimes(1);
      const { prompt, options } = queryMock.mock.calls[0][0];
      expect(prompt).toContain('pull_number 7');
      expect(prompt).toContain('octocat');
      expect(options.mcpServers).toEqual({
        github: mcpServersConfig.github,
        eslint: mcpServersConfig.eslint,
      });
      expect(options.allowedTools).toContain('mcp__github__get_pull_request_files');
      expect(options.outputFormat).toEqual({ type: 'json_schema', schema: ReviewReportJSONSchema });
    });

    it('should spawn all 3 subagents in parallel', async () => {
      queryMock.mockReturnValue(streamOf([successMessage(validReport)]));

      await new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 7);

      const { prompt, options } = queryMock.mock.calls[0][0];
      expect(Object.keys(options.agents).sort()).toEqual([
        'code-quality-analyzer',
        'refactoring-suggester',
        'test-coverage-analyzer',
      ]);
      expect(options.allowedTools).toContain('Task');
      expect(prompt).toContain('in parallel');
    });

    it('should aggregate results into ReviewReport', async () => {
      queryMock.mockReturnValue(streamOf([successMessage(validReport)]));

      const report = await new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 7);

      expect(report.pullRequest).toEqual(validReport.pullRequest);
      expect(report.fileReviews).toHaveLength(1);
      expect(report.summary.overallScore).toBe(60);
      expect(report.recommendations).toHaveLength(1);
      expect(report.metadata.analyzedAt).not.toBe(validReport.metadata.analyzedAt);
      expect(typeof report.metadata.duration).toBe('number');
    });

    it('should validate output with Zod schema', async () => {
      const invalid = { ...validReport, summary: { ...validReport.summary, overallScore: 'high' } };
      queryMock.mockReturnValue(streamOf([successMessage(invalid)]));

      await expect(
        new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 7)
      ).rejects.toMatchObject({ code: ErrorCodes.STRUCTURED_OUTPUT_FAILED });
    });

    it('throws a clear error when the SDK never produces a structured_output', async () => {
      queryMock.mockReturnValue(streamOf([{ type: 'assistant', message: { content: [] } }]));

      const error = await new CodeReviewOrchestrator()
        .reviewPullRequest('octocat', 'Hello-World', 7)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ReviewError);
      expect((error as ReviewError).code).toBe(ErrorCodes.STRUCTURED_OUTPUT_FAILED);
    });
  });

  describe('Integration', () => {
    // These tests require actual API keys and should be skipped in CI
    it.skip('should review a real small PR', async () => {
      const report = await new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1);
      expect(report.fileReviews.length).toBeGreaterThanOrEqual(0);
    });
  });
});


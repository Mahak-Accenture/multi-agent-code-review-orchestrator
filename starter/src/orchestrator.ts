import { ReviewReport } from './types/report-types';
import { query, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { mcpServersConfig } from './config/mcp.config.js';
import {codeQualityAnalyzer,testCoverageAnalyzer,refactoringSuggester} from './agents/index.js';
import { buildOrchestratorPrompt } from './prompts/index.js';
import { ReviewReportSchema, ReviewReportJSONSchema } from './types/index.js';
import { logger } from './utils/logger.js';
import { RateLimiter, withRateLimit, type RateLimiterConfig } from './utils/rate-limiter.js';
import { ReviewError, ErrorCodes } from './utils/error-handler.js';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  model?: string;
  maxTurns?: number;
  rateLimitConfig?: Partial<RateLimiterConfig>;
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {

  private readonly options: OrchestratorOptions;
  private readonly rateLimiter: RateLimiter;

  constructor(options: OrchestratorOptions = {}) {
    this.options = options;
    this.rateLimiter = new RateLimiter(options.rateLimitConfig);
  }

  /**
   * Review a pull request using parallel subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startedAt = Date.now();
    logger.info('Starting pull request review', { owner, repo, prNumber });

    const options: Options = {
      cwd: process.env.PROJECT_ROOT || process.cwd(),
      // Loads .claude/skills/ so subagents can invoke skills via the Skill tool
      settingSources: ['project'],
      model: this.options.model ?? process.env.ANTHROPIC_MODEL,
      maxTurns: this.options.maxTurns ?? 60,
      // Non-interactive CI run: tools outside allowedTools are denied, not prompted
      permissionMode: 'dontAsk',
      allowedTools: [
        'Task',
        'Skill',
        'Read',
        'Grep',
        'Glob',
        'mcp__github__get_pull_request',
        'mcp__github__get_pull_request_files',
        'mcp__github__get_file_contents',
        'mcp__github__search_code',
        'mcp__eslint__lint-files'
      ],
      mcpServers: {
        github: mcpServersConfig.github,
        eslint: mcpServersConfig.eslint
      },
      agents: {
        'code-quality-analyzer': codeQualityAnalyzer,
        'test-coverage-analyzer': testCoverageAnalyzer,
        'refactoring-suggester': refactoringSuggester
      },
      outputFormat: {
        type: 'json_schema',
        schema: ReviewReportJSONSchema
      }
    };

    const structuredOutput = await withRateLimit(this.rateLimiter, async () => {
      const res = query({
        prompt: buildOrchestratorPrompt(owner, repo, prNumber),
        options
      });

      let output: unknown;
      for await (const message of res as AsyncIterable<SDKMessage>) {
        if (message.type !== 'result') continue;
        if (message.subtype !== 'success') {
          throw new Error(`Review failed (${message.subtype}): ${message.errors.join('; ')}`);
        }
        output = message.structured_output;
      }
      return output;
    });

    const parsed = ReviewReportSchema.safeParse(structuredOutput);
    if (!parsed.success) {
      throw new ReviewError(
        `Review output failed schema validation: ${parsed.error.message}`,
        ErrorCodes.STRUCTURED_OUTPUT_FAILED,
        { issues: parsed.error.issues }
      );
    }

    const report: ReviewReport = {
      ...parsed.data,
      metadata: {
        ...parsed.data.metadata,
        analyzedAt: new Date().toISOString(),
        duration: Date.now() - startedAt
      }
    };

    logger.info('Pull request review complete', {
      prNumber,
      totalFiles: report.summary.totalFiles,
      durationMs: report.metadata.duration
    });
    return report;
  }
}
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

/**
 * Estimates test completeness by comparing a source file with its tests
 * and proposes concrete test cases for untested behavior.
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Evaluates whether a changed source file has adequate tests and suggests specific missing test cases. Use for every changed source file, not test files.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  tools: [
    'Read',
    'Grep',
    'Glob',
    'mcp__github__get_file_contents',
    'mcp__github__search_code'
  ],
  model: 'inherit'
};

import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

/**
 * Finds security, performance, and maintainability issues in changed files.
 * Uses the Skill tool to load domain skills from .claude/skills/.
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes a changed source file for security vulnerabilities, performance problems, bug risks, and maintainability issues. Use for every changed JavaScript/TypeScript file.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  tools: [
    'Read',
    'Grep',
    'Glob',
    'Skill',
    'mcp__github__get_file_contents',
    'mcp__eslint__lint-files'
  ],
  model: 'inherit'
};

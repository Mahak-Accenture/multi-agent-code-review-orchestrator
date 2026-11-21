import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

/**
 * Suggests structural improvements and modernizations that keep behavior unchanged.
 */
export const refactoringSuggester: AgentDefinition = {
  description:
    'Suggests refactorings that improve structure, clarity, and use of modern language patterns in a changed file, with before/after examples. Use for every changed source file.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  tools: [
    'Read',
    'Grep',
    'Skill',
    'Glob',
    'mcp__github__get_file_contents'
  ],
  model: 'inherit'
};

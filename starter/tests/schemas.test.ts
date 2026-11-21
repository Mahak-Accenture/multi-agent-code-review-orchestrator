import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  ReviewReportSchema,
  CodeQualityResultJSONSchema,
  ReviewReportJSONSchema
} from '../src/types/index.js';

const validCodeQuality = {
  file: 'src/utils/math.ts',
  issues: [{
    line: 12,
    severity: 'high',
    category: 'bug-risk',
    description: 'Division by zero is not guarded',
    suggestion: 'Return early when the divisor is 0'
  }],
  overallScore: 72,
  summary: 'Mostly clean with one bug risk'
};

const validTestCoverage = {
  file: 'src/utils/math.ts',
  hasTests: false,
  testFiles: [],
  untestedPaths: [{
    type: 'edge-case',
    location: 'divide(a, 0)',
    priority: 'high',
    reasoning: 'Zero divisor path is not exercised',
    suggestedTest: 'expect(divide(1, 0)).toBe(Infinity)'
  }],
  coverageEstimate: 0,
  summary: 'No tests exist for this file'
};

const validRefactorings = {
  file: 'src/utils/math.ts',
  suggestions: [{
    type: 'simplify',
    location: 'line 8-12',
    impact: 'low',
    description: 'Replace loop with reduce',
    before: 'let s = 0; for (const n of xs) s += n;',
    after: 'const s = xs.reduce((a, n) => a + n, 0);',
    benefits: 'Shorter and expresses intent directly'
  }],
  summary: 'One small simplification'
};

const validReport = {
  pullRequest: { owner: 'udacity', repo: 'cd14715-simple-todo-app', number: 1 },
  fileReviews: [{
    file: 'src/utils/math.ts',
    codeQuality: validCodeQuality,
    testCoverage: validTestCoverage,
    refactorings: validRefactorings
  }],
  summary: {
    totalFiles: 1,
    overallScore: 72,
    criticalIssues: 0,
    highPriorityTests: 1,
    refactoringOpportunities: 1
  },
  recommendations: [{
    priority: 'high',
    category: 'test-coverage',
    description: 'Add a test for the zero divisor path',
    files: ['src/utils/math.ts']
  }],
  metadata: {
    analyzedAt: '2025-01-01T00:00:00.000Z',
    duration: 1200,
    agentVersions: { 'code-quality-analyzer': '1.0.0' }
  }
};

describe('CodeQualityResultSchema', () => {
  it('accepts valid data', () => {
    expect(() => CodeQualityResultSchema.parse(validCodeQuality)).not.toThrow();
  });

  it('rejects an unknown severity value', () => {
    const invalid = {
      ...validCodeQuality,
      issues: [{ ...validCodeQuality.issues[0], severity: 'blocker' }]
    };
    expect(() => CodeQualityResultSchema.parse(invalid)).toThrow(ZodError);
  });

  it('rejects an issue missing the suggestion field', () => {
    const { suggestion: _suggestion, ...issueWithoutSuggestion } = validCodeQuality.issues[0];
    const invalid = { ...validCodeQuality, issues: [issueWithoutSuggestion] };
    expect(() => CodeQualityResultSchema.parse(invalid)).toThrow(ZodError);
  });

  it('accepts an empty issues array', () => {
    expect(() => CodeQualityResultSchema.parse({ ...validCodeQuality, issues: [] })).not.toThrow();
  });

  it('accepts score boundaries 0 and 100 but rejects values outside them', () => {
    expect(() => CodeQualityResultSchema.parse({ ...validCodeQuality, overallScore: 0 })).not.toThrow();
    expect(() => CodeQualityResultSchema.parse({ ...validCodeQuality, overallScore: 100 })).not.toThrow();
    expect(() => CodeQualityResultSchema.parse({ ...validCodeQuality, overallScore: 101 })).toThrow(ZodError);
    expect(() => CodeQualityResultSchema.parse({ ...validCodeQuality, overallScore: -1 })).toThrow(ZodError);
  });
});

describe('TestCoverageResultSchema', () => {
  it('accepts valid data', () => {
    expect(() => TestCoverageResultSchema.parse(validTestCoverage)).not.toThrow();
  });

  it('accepts empty testFiles and untestedPaths arrays', () => {
    const data = { ...validTestCoverage, testFiles: [], untestedPaths: [] };
    expect(() => TestCoverageResultSchema.parse(data)).not.toThrow();
  });

  it('rejects a priority value that only exists on code-quality issues', () => {
    const invalid = {
      ...validTestCoverage,
      untestedPaths: [{ ...validTestCoverage.untestedPaths[0], priority: 'info' }]
    };
    expect(() => TestCoverageResultSchema.parse(invalid)).toThrow(ZodError);
  });

  it('rejects a coverage estimate above 100', () => {
    expect(() => TestCoverageResultSchema.parse({ ...validTestCoverage, coverageEstimate: 101 })).toThrow(ZodError);
  });
});

describe('RefactoringSuggestionSchema', () => {
  it('accepts valid data and an empty suggestions array', () => {
    expect(() => RefactoringSuggestionSchema.parse(validRefactorings)).not.toThrow();
    expect(() => RefactoringSuggestionSchema.parse({ ...validRefactorings, suggestions: [] })).not.toThrow();
  });

  it('rejects an impact value outside low/medium/high', () => {
    const invalid = {
      ...validRefactorings,
      suggestions: [{ ...validRefactorings.suggestions[0], impact: 'critical' }]
    };
    expect(() => RefactoringSuggestionSchema.parse(invalid)).toThrow(ZodError);
  });
});

describe('ReviewReportSchema', () => {
  it('accepts a complete report', () => {
    expect(() => ReviewReportSchema.parse(validReport)).not.toThrow();
  });

  it('accepts a report with no reviewable files', () => {
    const empty = {
      ...validReport,
      fileReviews: [],
      recommendations: [],
      summary: { totalFiles: 0, overallScore: 0, criticalIssues: 0, highPriorityTests: 0, refactoringOpportunities: 0 }
    };
    expect(() => ReviewReportSchema.parse(empty)).not.toThrow();
  });

  it('rejects a report missing metadata', () => {
    const { metadata: _metadata, ...withoutMetadata } = validReport;
    expect(() => ReviewReportSchema.parse(withoutMetadata)).toThrow(ZodError);
  });
});

describe('JSON Schema export', () => {
  it('marks every property of a subagent result as required', () => {
    const schema = CodeQualityResultJSONSchema as { type?: string; required?: string[]; properties?: Record<string, unknown> };
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(expect.arrayContaining(['file', 'issues', 'overallScore', 'summary']));
    expect(Object.keys(schema.properties ?? {})).toEqual(expect.arrayContaining(['file', 'issues', 'overallScore', 'summary']));
  });

  it('exports the review report with its top-level required properties', () => {
    const schema = ReviewReportJSONSchema as { type?: string; required?: string[] };
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(
      expect.arrayContaining(['pullRequest', 'fileReviews', 'summary', 'recommendations', 'metadata'])
    );
  });
});

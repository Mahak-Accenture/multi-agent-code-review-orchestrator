import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { CodeReviewOrchestrator } from './orchestrator.js';
import path from 'path';
import { ReportGenerator, logger, ReviewError, formatError } from './utils/index.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */

const USAGE = 'Usage: npm run dev -- <owner> <repo> <pr-number>\n  Example: npm run dev -- octocat Hello-World 1';

/** Print a helpful error message and exit with a non-zero code */
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  // TODO: Validate command line arguments
  // - Check if owner, repo, and prStr are provided
  // - Convert prStr to number and validate it's a valid integer
  // - Exit with error message if validation fails
  if (!owner || !repo || !prStr) {
    fail(`Missing required arguments.\n  ${USAGE}`);
  }
  if (!/^\d+$/.test(prStr) || Number(prStr) < 1) {
    fail(`PR number must be a positive integer, got "${prStr}".\n  ${USAGE}`);
  }
  const prNumber = Number(prStr);

 
  console.log('start here', owner, repo, prStr)
  const requiredEnv = ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'GITHUB_TOKEN'] as const;
  const missing = requiredEnv.filter((key) => !process.env[key]);
  const hasAWSCredential = !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION
  );

  const hasAnthropicAPI = !!process.env.ANTHROPIC_API_KEY;

  if (missing.length > 0 || (!hasAnthropicAPI && !hasAWSCredential)) {
    const lines = ['Missing required environment configuration:'];
    for (const key of missing) lines.push(`  - ${key}`);
    lines.push('Also set either ANTHROPIC_API_KEY or AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION.');
    fail(lines.join('\n'));
    
  }
  
  if (hasAWSCredential && !hasAnthropicAPI) {
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicAPI) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    fail('No valid authentication method found. Please set either AWS credentials or ANTHROPIC_API_KEY.');
  }
  logger.info(`Starting review of ${owner}/${repo} PR #${prNumber}...`);

  try {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    const reportGenerator = new ReportGenerator();
    const outdir = 'reports';
    await fs.mkdir(outdir, { recursive: true });

    const base = `${owner}_${repo}_${prNumber}`;
    const json_path = path.join(outdir, `${base}.json`);
    const md_path = path.join(outdir, `${base}.md`);
    const html_path = path.join(outdir, `${base}.html`);

    await Promise.all([
      fs.writeFile(json_path, reportGenerator.generateJSONReport(report), 'utf-8'),
      fs.writeFile(md_path, reportGenerator.generateMarkdownReport(report), 'utf-8'),
      fs.writeFile(html_path, reportGenerator.generateHTMLReport(report), 'utf-8'),
    ]);

    logger.info('Review complete. Reports saved:');
    logger.info(`  JSON:     ${json_path}`);
    logger.info(`  Markdown: ${md_path}`);
    logger.info(`  HTML:     ${html_path}`);
    logger.info(`  Overall score: ${report.summary.overallScore}/100`);
  } catch (error) {
    if (error instanceof ReviewError) {
      console.error(`Review failed [${error.code}]: ${error.message}`);
    } else {
      console.error('Error:', formatError(error));
    }
    process.exit(1);
  }
}

main();

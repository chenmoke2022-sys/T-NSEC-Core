/**
 * showcase.ts
 *
 * Purpose:
 * - Provide a short, reproducible CLI entry that points reviewers to the most relevant artifacts.
 * - Output should be factual and verifiable.
 */

import * as fs from 'fs';
import * as path from 'path';

function exists(rel: string) {
  return fs.existsSync(path.resolve(process.cwd(), rel));
}

function readHead(rel: string, lines: number) {
  const full = path.resolve(process.cwd(), rel);
  const txt = fs.readFileSync(full, 'utf-8');
  return txt.split(/\r?\n/).slice(0, lines).join('\n');
}

function hr() {
  console.log('─'.repeat(78));
}

function printItem(label: string, rel: string) {
  console.log(`${exists(rel) ? 'OK' : 'MISSING'} ${label}: ${rel}`);
}

function main() {
  console.log('T-NSEC-CORE / Showcase');
  console.log(`cwd: ${process.cwd()}`);
  console.log(`time: ${new Date().toISOString()}`);
  hr();

  console.log('Key entry points:');
  printItem('Project README', 'README.md');
  printItem('Research summary', 'docs/research/RESEARCH_SUMMARY.md');
  printItem('Research index', 'docs/research/README.md');
  printItem('Evidence bundle index', 'benchmark/Research_Evidence_Bundle/README.md');
  hr();

  console.log('Selected verifiable artifacts:');
  printItem('Graph stress test CSV', 'benchmark/stress_test_100k.csv');
  printItem('Stress test chart', 'docs/assets/stress_test_100k.png');
  printItem('Superego curve', 'docs/assets/superego_learning_curve.png');
  printItem('Qwen sentence alignment metrics', 'benchmark/qwen-sentence-align/reports/alignment_metrics_v2_1.csv');
  hr();

  if (exists('benchmark/stress_test_100k.csv')) {
    console.log('stress_test_100k.csv (head):');
    console.log(readHead('benchmark/stress_test_100k.csv', 3));
    hr();
  }

  if (exists('benchmark/qwen-sentence-align/reports/alignment_metrics_v2_1.csv')) {
    console.log('alignment_metrics_v2_1.csv (head):');
    console.log(readHead('benchmark/qwen-sentence-align/reports/alignment_metrics_v2_1.csv', 4));
    hr();
  }

  console.log('Next commands:');
  console.log('- npm test');
  console.log('- npm run benchmark-full');
  console.log('- npm run dev   (Ollama proxy on 8080/8081)');
  hr();
}

main();



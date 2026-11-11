import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCurrency,
  formatCurrencySummary,
  getErrorMessage,
  getInitials,
  isOverdue,
} from '../src/utils/formatters.js';
import {
  mockGenerateMilestones,
  mockEvaluateSubmission,
  mockAskProjectAssistant,
  getCachedMockEvaluation,
} from '../src/services/aiMockService.js';
import { aiService } from '../src/services/aiService.js';

describe('formatters utility', () => {
  it('formats single and multi-currency summaries cleanly', () => {
    assert.equal(formatCurrency(125, 'USD'), '$125.00');
    assert.equal(formatCurrencySummary([], (x) => x.budget, (x) => x.currency), '$0.00');

    const single = formatCurrencySummary(
      [
        { budget: 100, currency: 'USD' },
        { budget: 200, currency: 'USD' },
      ],
      (x) => x.budget,
      (x) => x.currency
    );
    assert.equal(single, '$300.00');

    const mixed = formatCurrencySummary(
      [
        { budget: 100, currency: 'USD' },
        { budget: 50, currency: 'EUR' },
      ],
      (x) => x.budget,
      (x) => x.currency
    );
    assert.equal(mixed, '$100.00 + €50.00');
  });

  it('computes initials, error messages, and overdue flags accurately', () => {
    assert.equal(getInitials('Alex Client'), 'AC');
    assert.equal(getInitials(''), 'U');
    assert.equal(getErrorMessage({ response: { data: { error: 'Token expired' } } }), 'Token expired');

    const yesterday = new Date(Date.now() - 86400000).toISOString();
    assert.equal(isOverdue(yesterday, 'IN_PROGRESS'), true);
    assert.equal(isOverdue(yesterday, 'PAID'), false);
  });
});

describe('aiMockService & aiService facade', () => {
  it('generates balanced milestones summing exactly to fractional project budget', async () => {
    const milestones = await mockGenerateMilestones({
      title: 'React Auth & PayPal Dashboard',
      description: 'Build authentication, dashboard, and payment escrow workflows',
      budget: 333.33,
      deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    });

    assert.equal(milestones.length, 4);
    const total = milestones.reduce((sum, m) => sum + m.paymentAmount, 0);
    assert.ok(Math.abs(total - 333.33) < 0.001);
    for (const m of milestones) {
      assert.ok(m.title.length > 0);
      assert.ok(Array.isArray(m.deliverables) && m.deliverables.length > 0);
      assert.ok(Array.isArray(m.acceptanceCriteria) && m.acceptanceCriteria.length > 0);
    }
  });

  it('evaluates complete vs incomplete submissions and caches result by milestoneId', async () => {
    const milestone = {
      _id: 'ms-test-1',
      acceptanceCriteria: [
        { criteria: 'GitHub repository link provided' },
        { criteria: 'Screenshots and test notes attached' },
      ],
    };

    const weakEval = await mockEvaluateSubmission({
      milestone,
      submission: { _id: 'sub-1', version: 1, githubUrl: '', files: [], notes: 'done' },
    });
    assert.ok(weakEval.overallScore < 100);
    assert.ok(weakEval.missingRequirements.length > 0);

    const strongEval = await mockEvaluateSubmission({
      milestone,
      submission: {
        _id: 'sub-2',
        version: 2,
        githubUrl: 'https://github.com/example/repo',
        files: [{ filename: 'screen.png', url: 'https://example.com/screen.png', fileType: 'image' }],
        notes: 'Implemented all requirements and verified build passes cleanly.',
      },
    });
    assert.equal(strongEval.overallScore, 100);
    assert.equal(strongEval.missingRequirements.length, 0);
    assert.equal(getCachedMockEvaluation('ms-test-1')._id, strongEval._id);
  });

  it('answers project assistant queries about delays and PayPal escrow', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    const reply = await mockAskProjectAssistant({
      project: { title: 'Test App', status: 'ACTIVE', budget: 100, currency: 'USD' },
      milestones: [
        { order: 1, title: 'Setup', status: 'PAID', deadline: pastDate },
        { order: 2, title: 'API', status: 'IN_PROGRESS', deadline: pastDate },
      ],
      payment: { status: 'PARTIALLY_CAPTURED', totalAuthorized: 100, totalCaptured: 40, captures: [{}] },
      question: 'Which milestones are overdue?',
    });

    assert.match(reply.answer, /1 milestone\(s\) have passed their deadline/i);
    assert.ok(reply.highlights.length >= 2);
    assert.equal(aiService.isMockMode(), true);
  });
});


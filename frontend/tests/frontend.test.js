import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCurrency,
  formatCurrencySummary,
  getErrorMessage,
  getInitials,
  isOverdue,
} from '../src/utils/formatters.js';
import axiosClient from '../src/api/axiosClient.js';
import { aiService, USE_MOCK_AI } from '../src/services/aiService.js';

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

describe('aiService real LangGraph API facade', () => {
  it('runs with mock AI completely disabled', () => {
    assert.equal(USE_MOCK_AI, false);
    assert.equal(aiService.isMockMode(), false);
  });

  it('routes milestone preview and project generation to real backend endpoints', async () => {
    const calls = [];
    const originalPost = axiosClient.post;

    axiosClient.post = async (url, body, config) => {
      calls.push({ url, body, config });
      return {
        data: {
          success: true,
          data: {
            milestones: [
              {
                title: 'Setup',
                description: 'Init',
                paymentAmount: 100,
                deadline: '2026-12-10T00:00:00.000Z',
                deliverables: [{ title: 'Repo', description: 'Code' }],
                acceptanceCriteria: [{ criteria: 'Builds cleanly', completed: false }],
                order: 1,
              },
            ],
            requirementAnalysis: { missingOrAmbiguousRequirements: ['Clarify hosting target'] },
            persisted: Boolean(url.includes('/projects/')),
          },
        },
      };
    };

    try {
      const preview = await aiService.generateMilestones({
        title: 'Demo',
        description: 'Build demo app',
        budget: 100,
        currency: 'USD',
        deadline: '2026-12-31T00:00:00.000Z',
      });
      assert.equal(calls[0].url, '/ai/generate-milestones');
      assert.equal(preview.isMock, false);
      assert.equal(preview.milestones.length, 1);

      const projectGen = await aiService.generateMilestones({
        projectId: 'proj-123',
        title: 'Demo',
        description: 'Build demo app',
        budget: 100,
        currency: 'USD',
        deadline: '2026-12-31T00:00:00.000Z',
        persist: false,
      });
      assert.equal(calls[1].url, '/ai/projects/proj-123/generate-milestones');
      assert.equal(calls[1].body.persist, false);
      assert.equal(projectGen.isMock, false);
    } finally {
      axiosClient.post = originalPost;
    }
  });

  it('fetches and triggers AI deliverable evaluations and assistant answers', async () => {
    const originalGet = axiosClient.get;
    const originalPost = axiosClient.post;

    axiosClient.get = async () => {
      const err = new Error('Not found');
      err.response = { status: 404 };
      throw err;
    };

    axiosClient.post = async (url) => {
      if (url.endsWith('/evaluate')) {
        return {
          data: {
            success: true,
            data: {
              evaluation: {
                _id: 'eval-1',
                overallScore: 75,
                criteriaResults: [],
                completedRequirements: ['Auth'],
                missingRequirements: ['Tests'],
                improvementSuggestions: ['Add unit tests'],
                recommendations: 'Request modifications.',
                status: 'COMPLETED',
              },
            },
          },
        };
      }
      return {
        data: {
          success: true,
          data: {
            answer: 'One milestone is overdue.',
            highlights: ['ACTIVE'],
            suggestedNextSteps: ['Review submission'],
            intent: 'delay_risk',
            answeredAt: '2026-11-11T00:00:00.000Z',
          },
        },
      };
    };

    try {
      const empty = await aiService.getMilestoneEvaluation('ms-1');
      assert.equal(empty.evaluation, null);
      assert.equal(empty.isMock, false);

      const evaluated = await aiService.evaluateSubmission({
        milestone: { _id: 'ms-1' },
        submission: { _id: 'sub-1' },
      });
      assert.equal(evaluated.evaluation.overallScore, 75);
      assert.equal(evaluated.isMock, false);

      const reply = await aiService.askProjectAssistant({
        projectId: 'proj-1',
        question: 'Which milestones are delayed?',
      });
      assert.equal(reply.answer, 'One milestone is overdue.');
      assert.equal(reply.isMock, false);
    } finally {
      axiosClient.get = originalGet;
      axiosClient.post = originalPost;
    }
  });
});

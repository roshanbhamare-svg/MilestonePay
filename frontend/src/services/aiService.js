import axiosClient from '../api/axiosClient.js';
import {
  mockGenerateMilestones,
  mockEvaluateSubmission,
  mockAskProjectAssistant,
  getCachedMockEvaluation,
} from './aiMockService.js';

/**
 * AI Integration Facade (Member C -> Member D handover boundary)
 *
 * Member C keeps mock AI active while Member D builds the LangGraph.js agents.
 * To switch to real LangGraph endpoints, set VITE_USE_MOCK_AI=false in frontend/.env
 * (or flip USE_MOCK_AI below) once Member D completes:
 *   - POST /api/ai/projects/:projectId/generate-milestones
 *   - POST /api/ai/milestones/:milestoneId/evaluate
 *   - GET  /api/ai/milestones/:milestoneId/evaluation
 *   - POST /api/ai/projects/:projectId/assistant
 */
export const USE_MOCK_AI = import.meta.env?.VITE_USE_MOCK_AI !== 'false';

export const aiService = {
  isMockMode() {
    return USE_MOCK_AI;
  },

  /**
   * Generate structured milestones from project details.
   * Matches POST /api/milestones/project/:projectId/bulk payload shape.
   */
  async generateMilestones({ projectId, title, description, budget, currency, deadline }) {
    if (!USE_MOCK_AI && projectId) {
      const { data } = await axiosClient.post(`/ai/projects/${projectId}/generate-milestones`, {
        title,
        description,
        budget,
        currency,
        deadline,
      });
      const payload = data.data;
      if (Array.isArray(payload?.milestones)) {
        return { milestones: payload.milestones, isMock: false };
      }
      throw new Error('AI backend returned no milestones array');
    }

    const milestones = await mockGenerateMilestones({
      title,
      description,
      budget,
      currency,
      deadline,
    });
    return { milestones, isMock: true };
  },

  /**
   * Fetch stored AI evaluation from MongoDB first (Member B/D contract).
   * Falls back to session mock evaluation if USE_MOCK_AI is enabled and DB has none.
   */
  async getMilestoneEvaluation(milestoneId) {
    try {
      const { data } = await axiosClient.get(`/ai/milestones/${milestoneId}/evaluation`);
      if (data?.data?.evaluation) {
        return { evaluation: data.data.evaluation, isMock: false };
      }
    } catch (err) {
      if (err?.response?.status !== 404) {
        throw err;
      }
    }

    if (USE_MOCK_AI) {
      const cached = getCachedMockEvaluation(milestoneId);
      if (cached) {
        return { evaluation: cached, isMock: true };
      }
    }

    return { evaluation: null, isMock: USE_MOCK_AI };
  },

  /**
   * Trigger deliverable evaluation against milestone acceptance criteria.
   */
  async evaluateSubmission({ milestone, submission }) {
    if (!USE_MOCK_AI) {
      const { data } = await axiosClient.post(`/ai/milestones/${milestone._id}/evaluate`, {
        submissionId: submission?._id,
      });
      if (data?.data?.evaluation) {
        return { evaluation: data.data.evaluation, isMock: false };
      }
      const fetched = await this.getMilestoneEvaluation(milestone._id);
      if (fetched.evaluation) {
        return fetched;
      }
      throw new Error('AI evaluation completed without returning a report');
    }

    const evaluation = await mockEvaluateSubmission({ milestone, submission });
    return { evaluation, isMock: true };
  },

  /**
   * Project Q&A, status summary, and delay inspection assistant.
   */
  async askProjectAssistant({ projectId, project, milestones, payment, question }) {
    if (!USE_MOCK_AI && projectId) {
      const { data } = await axiosClient.post(`/ai/projects/${projectId}/assistant`, {
        question,
      });
      const response = data.data;
      return {
        answer: response.answer || response.message || '',
        highlights: response.highlights || [],
        suggestedNextSteps: response.suggestedNextSteps || [],
        answeredAt: response.answeredAt || new Date().toISOString(),
        isMock: false,
      };
    }

    const mockReply = await mockAskProjectAssistant({
      project,
      milestones,
      payment,
      question,
    });
    return { ...mockReply, isMock: true };
  },
};

import axiosClient from '../api/axiosClient.js';

/**
 * AI Integration Service (Member D – LangGraph.js Backend)
 *
 * Connects frontend AI features directly to Express + LangGraph.js backend routes:
 *   - POST /api/ai/generate-milestones (unpersisted preview for new project creation)
 *   - POST /api/ai/projects/:projectId/generate-milestones
 *   - POST /api/ai/milestones/:milestoneId/evaluate
 *   - GET  /api/ai/milestones/:milestoneId/evaluation
 *   - POST /api/ai/projects/:projectId/assistant
 */
export const USE_MOCK_AI = false;

const AI_REQUEST_TIMEOUT_MS = 90000;

export const aiService = {
  isMockMode() {
    return false;
  },

  /**
   * Generate structured milestones from project details via LangGraph.js.
   * Uses the preview endpoint before a projectId exists, or the project endpoint when editing.
   */
  async generateMilestones({
    projectId = null,
    title,
    description,
    budget,
    currency,
    deadline,
    persist = false,
  }) {
    const endpoint = projectId
      ? `/ai/projects/${projectId}/generate-milestones`
      : '/ai/generate-milestones';

    const { data } = await axiosClient.post(
      endpoint,
      {
        title,
        description,
        budget,
        currency,
        deadline,
        ...(projectId ? { persist } : {}),
      },
      { timeout: AI_REQUEST_TIMEOUT_MS }
    );

    const payload = data?.data;
    if (!Array.isArray(payload?.milestones)) {
      throw new Error('AI backend returned no milestones array');
    }

    return {
      milestones: payload.milestones,
      requirementAnalysis: payload.requirementAnalysis || null,
      tasks: payload.tasks || [],
      persisted: Boolean(payload.persisted),
      isMock: false,
    };
  },

  /**
   * Fetch the latest persisted AI evaluation report from MongoDB.
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

    return { evaluation: null, isMock: false };
  },

  /**
   * Trigger LangGraph deliverable evaluation against milestone acceptance criteria.
   */
  async evaluateSubmission({ milestone, submission }) {
    const { data } = await axiosClient.post(
      `/ai/milestones/${milestone._id}/evaluate`,
      {
        submissionId: submission?._id,
      },
      { timeout: AI_REQUEST_TIMEOUT_MS }
    );

    if (data?.data?.evaluation) {
      return { evaluation: data.data.evaluation, isMock: false };
    }

    const fetched = await this.getMilestoneEvaluation(milestone._id);
    if (fetched.evaluation) {
      return fetched;
    }

    throw new Error('AI evaluation completed without returning a report');
  },

  /**
   * Ask the LangGraph AI Project Assistant about scope, delays, disputes, or PayPal status.
   */
  async askProjectAssistant({ projectId, question }) {
    if (!projectId) {
      throw new Error('projectId is required to ask the AI project assistant');
    }

    const { data } = await axiosClient.post(
      `/ai/projects/${projectId}/assistant`,
      { question },
      { timeout: AI_REQUEST_TIMEOUT_MS }
    );

    const response = data?.data || {};
    return {
      answer: response.answer || response.message || '',
      highlights: response.highlights || [],
      suggestedNextSteps: response.suggestedNextSteps || [],
      intent: response.intent || 'general',
      answeredAt: response.answeredAt || new Date().toISOString(),
      isMock: false,
    };
  },
};

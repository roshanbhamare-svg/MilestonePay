import axiosClient from './axiosClient';

export const approvalApi = {
  async startReview(milestoneId) {
    const { data } = await axiosClient.post(`/approvals/${milestoneId}/review`);
    return data.data.milestone;
  },

  async approveMilestone(milestoneId) {
    const { data } = await axiosClient.post(`/approvals/${milestoneId}/approve`);
    return data.data.milestone;
  },

  async requestChanges(milestoneId, reason) {
    const { data } = await axiosClient.post(`/approvals/${milestoneId}/request-changes`, {
      reason,
    });
    return data.data;
  },
};


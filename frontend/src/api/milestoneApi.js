import axiosClient from './axiosClient';

export const milestoneApi = {
  async getProjectMilestones(projectId) {
    const { data } = await axiosClient.get(`/milestones/project/${projectId}`);
    return data.data.milestones;
  },

  async createMilestone(projectId, payload) {
    const { data } = await axiosClient.post(`/milestones/project/${projectId}`, payload);
    return data.data.milestone;
  },

  async createBulkMilestones(projectId, milestones) {
    const { data } = await axiosClient.post(`/milestones/project/${projectId}/bulk`, {
      milestones,
    });
    return data.data.milestones;
  },

  async updateMilestone(milestoneId, payload) {
    const { data } = await axiosClient.put(`/milestones/${milestoneId}`, payload);
    return data.data.milestone;
  },

  async updateMilestoneStatus(milestoneId, status) {
    const { data } = await axiosClient.patch(`/milestones/${milestoneId}/status`, { status });
    return data.data.milestone;
  },
};


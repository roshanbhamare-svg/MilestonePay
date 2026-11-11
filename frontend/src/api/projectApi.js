import axiosClient from './axiosClient';

export const projectApi = {
  async createProject(payload) {
    const { data } = await axiosClient.post('/projects', payload);
    return data.data.project;
  },

  async getMyProjects() {
    const { data } = await axiosClient.get('/projects');
    return data.data.projects;
  },

  async getProjectById(projectId) {
    const { data } = await axiosClient.get(`/projects/${projectId}`);
    return data.data.project;
  },

  async updateProject(projectId, payload) {
    const { data } = await axiosClient.put(`/projects/${projectId}`, payload);
    return data.data.project;
  },

  async cancelProject(projectId) {
    const { data } = await axiosClient.post(`/projects/${projectId}/cancel`);
    return data.data.project;
  },

  async assignFreelancer(projectId, freelancerId) {
    const { data } = await axiosClient.post(`/projects/${projectId}/assign`, { freelancerId });
    return data.data.project;
  },

  async acceptAgreement(projectId) {
    const { data } = await axiosClient.post(`/projects/${projectId}/accept`);
    return data.data.project;
  },

  async rejectAgreement(projectId) {
    const { data } = await axiosClient.post(`/projects/${projectId}/reject`);
    return data.data.project;
  },

  async getFreelancers() {
    const { data } = await axiosClient.get('/users/freelancers');
    return data.data.freelancers;
  },

  async getUserById(userId) {
    const { data } = await axiosClient.get(`/users/${userId}`);
    return data.data.user;
  },
};


import axiosClient from './axiosClient';

export const submissionApi = {
  async submitWork(milestoneId, payload) {
    const { data } = await axiosClient.post(`/submissions/milestone/${milestoneId}`, payload);
    return data.data.submission;
  },

  async getSubmissions(milestoneId) {
    const { data } = await axiosClient.get(`/submissions/milestone/${milestoneId}`);
    return data.data.submissions;
  },

  async getSubmissionById(submissionId) {
    const { data } = await axiosClient.get(`/submissions/${submissionId}`);
    return data.data.submission;
  },
};


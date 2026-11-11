import axiosClient from './axiosClient';

export const paymentApi = {
  async authorizeProjectPayment(projectId) {
    const { data } = await axiosClient.post(`/payments/projects/${projectId}/authorize`);
    return data.data;
  },

  async completeAuthorization(orderId) {
    const { data } = await axiosClient.post('/payments/complete-authorization', { orderId });
    return data.data;
  },

  async captureMilestonePayment(milestoneId) {
    const { data } = await axiosClient.post(`/payments/milestones/${milestoneId}/capture`);
    return data.data;
  },

  async getProjectPayments(projectId) {
    const { data } = await axiosClient.get(`/payments/projects/${projectId}`);
    return data.data.payment;
  },

  async voidProjectPayment(projectId) {
    const { data } = await axiosClient.post(`/payments/projects/${projectId}/void`);
    return data.data;
  },

  async getHealth() {
    const { data } = await axiosClient.get('/health');
    return data;
  },
};


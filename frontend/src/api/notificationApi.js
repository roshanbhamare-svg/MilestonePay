import axiosClient from './axiosClient';

export const notificationApi = {
  async getMyNotifications() {
    const { data } = await axiosClient.get('/notifications');
    return data.data;
  },

  async markAsRead(notificationId) {
    const { data } = await axiosClient.patch(`/notifications/${notificationId}/read`);
    return data.data.notification;
  },

  async markAllAsRead() {
    const { data } = await axiosClient.patch('/notifications/mark-all-read');
    return data;
  },
};


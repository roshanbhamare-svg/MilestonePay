import axiosClient from './axiosClient';

export const authApi = {
  async register(payload) {
    const { data } = await axiosClient.post('/auth/register', payload);
    return data.data;
  },

  async login(payload) {
    const { data } = await axiosClient.post('/auth/login', payload);
    return data.data;
  },

  async getProfile() {
    const { data } = await axiosClient.get('/auth/profile');
    return data.data.user;
  },

  async updateProfile(payload) {
    const { data } = await axiosClient.put('/auth/profile', payload);
    return data.data.user;
  },
};


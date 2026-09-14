import { apiClient } from '../client';

export const partyApi = {
  getParties: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await apiClient(`/parties${queryString}`);
  },

  getPartyById: async (id) => {
    return await apiClient(`/parties/${id}`);
  },

  createParty: async (partyData) => {
    return await apiClient('/parties', {
      method: 'POST',
      body: JSON.stringify(partyData),
    });
  },

  updateParty: async (id, partyData) => {
    return await apiClient(`/parties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(partyData),
    });
  },

  updatePartyStatus: async (id, status) => {
    return await apiClient(`/parties/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getPartyTimeline: async (partyId, params = {}) => {
    const query = new URLSearchParams();
    if (params.from) query.append('from', params.from);
    if (params.to) query.append('to', params.to);
    if (params.type && params.type !== 'ALL') query.append('type', params.type);
    if (params.paymentStatus && params.paymentStatus !== 'ALL') query.append('paymentStatus', params.paymentStatus);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await apiClient(`/parties/${partyId}/timeline${queryString}`);
  },
};

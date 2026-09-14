import { apiClient } from '../client';

export const transactionApi = {
  createTransaction: async (data) => {
    return await apiClient('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createFastTransaction: async (data) => {
    return await apiClient('/transactions/fast', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getTransactions: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/transactions?${queryString}` : '/transactions';
    return await apiClient(endpoint);
  },

  getTransaction: async (id) => {
    return await apiClient(`/transactions/${id}`);
  },

  updateTransactionStatus: async (id, status) => {
    return await apiClient(`/transactions/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  // Submit weights: transitions DRAFT → RATE
  submitWeights: async (transactionId) => {
    return await apiClient(`/transactions/${transactionId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: 'RATE' })
    });
  },

  addWeightEntry: async (transactionVarietyId, data) => {
    return await apiClient(`/transaction-varieties/${transactionVarietyId}/weights`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateWeightEntry: async (id, data) => {
    return await apiClient(`/weight-entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteWeightEntry: async (id) => {
    return await apiClient(`/weight-entries/${id}`, {
      method: 'DELETE'
    });
  },

  // Set rate for a single transaction variety (RATE stage)
  setVarietyRate: async (transactionVarietyId, rate) => {
    return await apiClient(`/transaction-varieties/${transactionVarietyId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rate })
    });
  },

  // Finalize the transaction: creates bill with amounts (must be in RATE status, all rates set)
  finalizeTransaction: async (transactionId) => {
    return await apiClient(`/transactions/${transactionId}/finalize`, {
      method: 'POST'
    });
  },

  getBillById: async (billId) => {
    return await apiClient(`/bills/${billId}`);
  },

  getBillByTransactionId: async (transactionId) => {
    return await apiClient(`/transactions/${transactionId}/bill`);
  },

  // Mark a completed bill as paid
  markBillPaid: async (billId) => {
    return await apiClient(`/bills/${billId}/mark-paid`, {
      method: 'POST'
    });
  },

  // Get outstanding unpaid total for a party
  getPartyOutstanding: async (partyId) => {
    return await apiClient(`/bills/outstanding?partyId=${partyId}`);
  },

  // Custom API methods for linking products and varieties to a transaction
  addTransactionProduct: async (transactionId, data) => {
    return await apiClient(`/transactions/${transactionId}/products`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  addTransactionVariety: async (transactionProductId, data) => {
    return await apiClient(`/transaction-products/${transactionProductId}/varieties`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};

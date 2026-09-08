import { apiClient } from '../client';

export const productApi = {
  getProducts: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return await apiClient(`/products${queryString}`);
  },

  getProductById: async (id) => {
    return await apiClient(`/products/${id}`);
  },

  createProduct: async (productData) => {
    return await apiClient('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  updateProduct: async (id, productData) => {
    return await apiClient(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  },
  
  getProductVarieties: async (productId) => {
    return await apiClient(`/products/${productId}/varieties`); 
  },

  createVariety: async (productId, varietyData) => {
    return await apiClient(`/products/${productId}/varieties`, {
      method: 'POST',
      body: JSON.stringify(varietyData),
    });
  },

  updateVariety: async (varietyId, varietyData) => {
    return await apiClient(`/varieties/${varietyId}`, {
      method: 'PUT',
      body: JSON.stringify(varietyData),
    });
  },
};

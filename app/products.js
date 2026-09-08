import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { Feather } from '@expo/vector-icons';
import { productApi } from '../api/services/productApi';

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [varietiesByProduct, setVarietiesByProduct] = useState({});
  const [expandedProducts, setExpandedProducts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add Product Modal State
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [productName, setProductName] = useState('');
  const [productLocalName, setProductLocalName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productNameError, setProductNameError] = useState('');
  const [productFormError, setProductFormError] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Add Variety Modal State
  const [isVarietyModalVisible, setIsVarietyModalVisible] = useState(false);
  const [targetProduct, setTargetProduct] = useState(null);
  const [varietyName, setVarietyName] = useState('');
  const [varietyLocalName, setVarietyLocalName] = useState('');
  const [varietyDesc, setVarietyDesc] = useState('');
  const [varietyNameError, setVarietyNameError] = useState('');
  const [varietyFormError, setVarietyFormError] = useState('');
  const [isSavingVariety, setIsSavingVariety] = useState(false);

  useEffect(() => {
    loadProductsAndVarieties();
  }, []);

  const loadProductsAndVarieties = async () => {
    try {
      setIsLoading(true);
      const res = await productApi.getProducts({ limit: 100 });
      if (res.success) {
        setProducts(res.data);
        
        // Fetch varieties for all products
        const varMap = {};
        for (const prod of res.data) {
          const varRes = await productApi.getProductVarieties(prod.id);
          if (varRes.success) {
            varMap[prod.id] = varRes.data;
          }
        }
        setVarietiesByProduct(varMap);
      }
    } catch (error) {
      console.error('Failed to load products and varieties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (productId) => {
    setExpandedProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const openAddProductModal = () => {
    setProductName('');
    setProductLocalName('');
    setProductDesc('');
    setProductNameError('');
    setProductFormError('');
    setIsProductModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!productName.trim()) {
      setProductNameError('Product name is required');
      return;
    }

    setIsSavingProduct(true);
    setProductFormError('');

    try {
      const res = await productApi.createProduct({
        name: productName.trim(),
        local_name: productLocalName.trim() || undefined,
        description: productDesc.trim() || undefined,
      });

      if (res.success && res.data) {
        setIsProductModalVisible(false);
        loadProductsAndVarieties();
      } else {
        setProductFormError(res.message || 'Failed to create product');
      }
    } catch (err) {
      setProductFormError(err.message || 'Network error occurred');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const openAddVarietyModal = (product) => {
    setTargetProduct(product);
    setVarietyName('');
    setVarietyLocalName('');
    setVarietyDesc('');
    setVarietyNameError('');
    setVarietyFormError('');
    setIsVarietyModalVisible(true);
  };

  const handleSaveVariety = async () => {
    if (!varietyName.trim()) {
      setVarietyNameError('Variety name is required');
      return;
    }

    if (!targetProduct) return;

    setIsSavingVariety(true);
    setVarietyFormError('');

    try {
      const res = await productApi.createVariety(targetProduct.id, {
        name: varietyName.trim(),
        local_name: varietyLocalName.trim() || undefined,
        description: varietyDesc.trim() || undefined,
      });

      if (res.success && res.data) {
        setIsVarietyModalVisible(false);
        // Update local varieties
        setVarietiesByProduct(prev => ({
          ...prev,
          [targetProduct.id]: [...(prev[targetProduct.id] || []), res.data]
        }));
        // Auto-expand product
        setExpandedProducts(prev => ({ ...prev, [targetProduct.id]: true }));
      } else {
        setVarietyFormError(res.message || 'Failed to create variety');
      }
    } catch (err) {
      setVarietyFormError(err.message || 'Network error occurred');
    } finally {
      setIsSavingVariety(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.local_name && p.local_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderProductItem = ({ item: product }) => {
    const isExpanded = expandedProducts[product.id] !== false; // expanded by default
    const varieties = varietiesByProduct[product.id] || [];

    return (
      <View className="bg-card rounded-2xl mb-4 border border-border overflow-hidden shadow-sm elevation-1">
        {/* Product Card Header */}
        <TouchableOpacity
          onPress={() => toggleExpand(product.id)}
          activeOpacity={0.7}
          className="p-5 flex-row items-center justify-between bg-card"
        >
          <View className="flex-row items-center flex-1 mr-3">
            <View className="w-12 h-12 bg-emerald-50 rounded-2xl items-center justify-center mr-3 border border-emerald-100">
              <Feather name="box" size={22} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="text-[18px] font-bold text-textMain">{product.name}</Text>
              {product.local_name ? (
                <Text className="text-[13px] text-textSecondary">{product.local_name}</Text>
              ) : null}
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <View className="px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-200 mr-1">
              <Text className="text-[12px] font-bold text-primary">{varieties.length} varieties</Text>
            </View>
            <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#64748B" />
          </View>
        </TouchableOpacity>

        {/* Varieties Sub-List */}
        {isExpanded ? (
          <View className="px-5 pb-5 pt-1 bg-background/50 border-t border-border/60">
            <View className="flex-row justify-between items-center mb-3 mt-2">
              <Text className="text-[12px] font-bold text-textSecondary uppercase tracking-widest">
                Varieties
              </Text>
              <TouchableOpacity
                onPress={() => openAddVarietyModal(product)}
                className="flex-row items-center py-1 px-2.5 bg-emerald-50 rounded-lg border border-emerald-200"
              >
                <Feather name="plus" size={13} color="#10B981" />
                <Text className="text-[12px] font-bold text-primary ml-1">Add Variety</Text>
              </TouchableOpacity>
            </View>

            {varieties.length === 0 ? (
              <View className="py-3 px-4 rounded-xl bg-card border border-dashed border-border items-center">
                <Text className="text-[13px] text-textSecondary mb-2">No varieties created yet</Text>
                <TouchableOpacity onPress={() => openAddVarietyModal(product)}>
                  <Text className="text-[13px] font-bold text-primary">+ Add First Variety</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="gap-2">
                {varieties.map((v) => (
                  <View
                    key={v.id}
                    className="p-3 bg-card rounded-xl border border-border flex-row items-center justify-between"
                  >
                    <View className="flex-1">
                      <Text className="text-[15px] font-bold text-textMain">{v.name}</Text>
                      {v.local_name ? (
                        <Text className="text-[12px] text-textSecondary">{v.local_name}</Text>
                      ) : null}
                    </View>
                    <View className="w-2 h-2 rounded-full bg-emerald-500" />
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenContainer>
      <View className="flex-1">
        
        {/* Search Bar */}
        <View className="mb-4">
          <InputField
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            rightIcon="search"
          />
        </View>

        {/* Products List */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderProductItem}
            contentContainerClassName="pb-24"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                icon="box"
                title="No products found"
                description={searchQuery ? `No results matching "${searchQuery}"` : "Add your first grain or agricultural product."}
              />
            }
          />
        )}

        {/* Floating Add Product Button */}
        <View className="absolute bottom-6 left-0 right-0 px-2">
          <Button
            title="+ ADD NEW PRODUCT"
            onPress={openAddProductModal}
          />
        </View>

        {/* Add Product Modal */}
        <Modal
          visible={isProductModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsProductModalVisible(false)}
        >
          <KeyboardAvoidingView
            className="flex-1 justify-end bg-black/50"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View className="bg-card rounded-t-3xl p-6 border-t border-border max-h-[90%] shadow-lg">
              <View className="flex-row justify-between items-center mb-5 pb-3 border-b border-border">
                <Text className="text-[20px] font-extrabold text-textMain">Add New Product</Text>
                <TouchableOpacity
                  onPress={() => setIsProductModalVisible(false)}
                  className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
                >
                  <Feather name="x" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {productFormError ? (
                  <View key="prod-error" className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex-row items-center">
                    <Feather name="alert-circle" size={18} color="#EF4444" />
                    <Text className="text-red-700 text-[13px] font-medium ml-2 flex-1">{productFormError}</Text>
                  </View>
                ) : null}

                <InputField
                  label="Product Name *"
                  placeholder="e.g. Paddy / Rice / Maize / Wheat"
                  value={productName}
                  onChangeText={(text) => {
                    setProductName(text);
                    if (productNameError) setProductNameError('');
                  }}
                  error={productNameError}
                />

                <InputField
                  label="Local Name (Optional)"
                  placeholder="e.g. ಭತ್ತ / ಜೋಳ / ಗೋಧಿ"
                  value={productLocalName}
                  onChangeText={setProductLocalName}
                />

                <InputField
                  label="Description (Optional)"
                  placeholder="e.g. Agricultural commodity"
                  value={productDesc}
                  onChangeText={setProductDesc}
                />

                <View className="mt-4 mb-6 flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      title="CANCEL"
                      type="secondary"
                      onPress={() => setIsProductModalVisible(false)}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      title={isSavingProduct ? "SAVING..." : "SAVE PRODUCT"}
                      onPress={handleSaveProduct}
                      disabled={isSavingProduct}
                    />
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Add Variety Modal */}
        <Modal
          visible={isVarietyModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsVarietyModalVisible(false)}
        >
          <KeyboardAvoidingView
            className="flex-1 justify-end bg-black/50"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View className="bg-card rounded-t-3xl p-6 border-t border-border max-h-[90%] shadow-lg">
              <View className="flex-row justify-between items-center mb-5 pb-3 border-b border-border">
                <View>
                  <Text className="text-[20px] font-extrabold text-textMain">Add Variety</Text>
                  <Text className="text-[13px] font-medium text-textSecondary">Product: {targetProduct?.name}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsVarietyModalVisible(false)}
                  className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
                >
                  <Feather name="x" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {varietyFormError ? (
                  <View key="var-error" className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex-row items-center">
                    <Feather name="alert-circle" size={18} color="#EF4444" />
                    <Text className="text-red-700 text-[13px] font-medium ml-2 flex-1">{varietyFormError}</Text>
                  </View>
                ) : null}

                <InputField
                  label="Variety Name *"
                  placeholder="e.g. Sona Masoori / IR-64 / BPT 5204"
                  value={varietyName}
                  onChangeText={(text) => {
                    setVarietyName(text);
                    if (varietyNameError) setVarietyNameError('');
                  }}
                  error={varietyNameError}
                />

                <InputField
                  label="Local Name (Optional)"
                  placeholder="e.g. ಸೋನಾ ಮಸೂರಿ"
                  value={varietyLocalName}
                  onChangeText={setVarietyLocalName}
                />

                <InputField
                  label="Description (Optional)"
                  placeholder="e.g. Premium fine grain"
                  value={varietyDesc}
                  onChangeText={setVarietyDesc}
                />

                <View className="mt-4 mb-6 flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      title="CANCEL"
                      type="secondary"
                      onPress={() => setIsVarietyModalVisible(false)}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      title={isSavingVariety ? "SAVING..." : "SAVE VARIETY"}
                      onPress={handleSaveVariety}
                      disabled={isSavingVariety}
                    />
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </View>
    </ScreenContainer>
  );
}

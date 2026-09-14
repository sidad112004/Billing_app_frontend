import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import { Feather } from '@expo/vector-icons';
import { productApi } from '../api/services/productApi';
import { useTransaction } from '../context/TransactionContext';

export default function SelectProducts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Add Product Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [localName, setLocalName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [formError, setFormError] = useState('');

  const { transactionState, toggleProduct } = useTransaction();
  
  const selectedParty = transactionState.party;
  const selectedProducts = transactionState.selectedProducts;
  
  const isContinueDisabled = selectedProducts.length === 0;

  useEffect(() => {
    if (!selectedParty) {
      router.replace('/select-party');
      return;
    }
    loadProducts();
  }, [selectedParty]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const res = await productApi.getProducts({ limit: 100 });
      if (res.success) {
        setProducts(res.data);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadProducts();
  };

  // Filter products based on search query
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (product.local_name && product.local_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isSelected = (productId) => {
    return selectedProducts.some(p => p.id === productId);
  };

  const handleToggleProduct = (product) => {
    toggleProduct(product);
  };

  const handleOpenAddModal = () => {
    setName('');
    setLocalName('');
    setDescription('');
    setNameError('');
    setFormError('');
    setIsModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!name.trim()) {
      setNameError('Product name is required');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const res = await productApi.createProduct({
        name: name.trim(),
        local_name: localName.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (res.success && res.data) {
        setIsModalVisible(false);
        // Automatically add to list and select the newly created product
        const newProduct = res.data;
        setProducts(prev => [newProduct, ...prev]);
        toggleProduct(newProduct);
      } else {
        setFormError(res.message || 'Failed to create product');
      }
    } catch (err) {
      setFormError(err.message || 'Network error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const renderProductItem = ({ item }) => {
    const selected = isSelected(item.id);
    
    return (
      <TouchableOpacity 
        className={`bg-card rounded-2xl p-4 mb-4 flex-row items-center border-[2px] shadow-sm elevation-1 ${selected ? 'border-primary bg-[#ECFDF5]' : 'border-border'}`}
        onPress={() => handleToggleProduct(item)}
        activeOpacity={0.7}
      >
        <View className="w-14 h-14 rounded-full bg-background items-center justify-center mr-4 border border-border">
          <Feather name="box" size={24} color={selected ? "#10B981" : "#94A3B8"} />
        </View>
        
        <View className="flex-1">
          <Text className="text-[18px] font-bold text-textMain mb-1">{item.name}</Text>
          {item.local_name ? <Text className="text-[14px] font-medium text-textSecondary">{item.local_name}</Text> : null}
        </View>
        
        <View className={`w-8 h-8 rounded-full border-[2px] items-center justify-center ${selected ? 'bg-primary border-primary' : 'bg-card border-border'}`}>
          {selected && <Feather name="check" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <View className="flex-1">
        
        {/* Party Badge */}
        {selectedParty && (
          <View className="bg-card p-5 rounded-2xl border border-border mb-6 shadow-sm elevation-1">
            <Text className="text-[12px] font-bold text-textSecondary tracking-[1px] uppercase mb-1">Transaction With</Text>
            <Text className="text-[22px] font-extrabold text-textMain mb-1">{selectedParty.name}</Text>
            <View className="flex-row items-center">
              <Feather name="map-pin" size={14} color="#64748B" /> 
              <Text className="text-[14px] text-textSecondary ml-1 font-medium">{selectedParty.location || 'No location'}</Text>
            </View>
          </View>
        )}

        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-[16px] font-bold text-textSecondary flex-1">Select products for transaction</Text>
          <TouchableOpacity
            onPress={handleOpenAddModal}
            className="flex-row items-center py-1.5 px-3 bg-emerald-50 rounded-xl border border-emerald-200"
          >
            <Feather name="plus-circle" size={16} color="#10B981" />
            <Text className="text-[13px] font-bold text-primary ml-1.5">Add Product</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-2">
          <InputField
            placeholder="Search product..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            rightIcon="search"
          />
        </View>

        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderProductItem}
            contentContainerClassName="pb-4"
            showsVerticalScrollIndicator={false}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <Text className="text-center text-textSecondary mt-8 text-[16px]">No products found matching "{searchQuery}"</Text>
            }
          />
        )}

        <View className="pt-4 pb-2">
          <Button 
            title="CONTINUE TO VARIETIES" 
            onPress={() => router.push('/select-varieties')} 
            type={isContinueDisabled ? 'secondary' : 'primary'}
            disabled={isContinueDisabled}
          />
        </View>

        {/* Add Product Modal */}
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <KeyboardAvoidingView
            className="flex-1 justify-end bg-black/50"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View className="bg-card rounded-t-3xl p-6 border-t border-border max-h-[90%] shadow-lg">
              <View className="flex-row justify-between items-center mb-5 pb-3 border-b border-border">
                <Text className="text-[20px] font-extrabold text-textMain">Add New Product</Text>
                <TouchableOpacity
                  onPress={() => setIsModalVisible(false)}
                  className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
                >
                  <Feather name="x" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {formError ? (
                  <View key="product-form-error" className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex-row items-center">
                    <Feather name="alert-circle" size={18} color="#EF4444" />
                    <Text className="text-red-700 text-[13px] font-medium ml-2 flex-1">{formError}</Text>
                  </View>
                ) : null}

                <InputField
                  label="Product Name *"
                  placeholder="e.g. Paddy / Rice / Maize / Cotton"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (nameError) setNameError('');
                  }}
                  error={nameError}
                />

                <InputField
                  label="Local Name (Optional)"
                  placeholder="e.g. ಭತ್ತ / ಜೋಳ / ಹತ್ತಿ"
                  value={localName}
                  onChangeText={setLocalName}
                />

                <InputField
                  label="Description (Optional)"
                  placeholder="e.g. Raw grain commodity"
                  value={description}
                  onChangeText={setDescription}
                />

                <View className="mt-4 mb-6 flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      title="CANCEL"
                      type="secondary"
                      onPress={() => setIsModalVisible(false)}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      title={isSaving ? "SAVING..." : "SAVE & SELECT"}
                      onPress={handleSaveProduct}
                      disabled={isSaving}
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

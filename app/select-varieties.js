import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import { Feather } from '@expo/vector-icons';
import { productApi } from '../api/services/productApi';
import { useTransaction } from '../context/TransactionContext';

export default function SelectVarieties() {
  const { transactionState, toggleVariety, setTransactionMode } = useTransaction();
  
  const { party, selectedProducts, selectedVarieties } = transactionState;
  
  const [varietiesByProduct, setVarietiesByProduct] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Add Variety Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [targetProduct, setTargetProduct] = useState(null);
  const [varietyName, setVarietyName] = useState('');
  const [localName, setLocalName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Transaction Mode Selection Modal
  const [isModeModalVisible, setIsModeModalVisible] = useState(false);

  const isContinueDisabled = selectedVarieties.length === 0;

  // Use a stable dependency: comma-joined product IDs string.
  const productIdsKey = selectedProducts.map(p => p.id).join(',');
  const partyId = party?.id;

  useEffect(() => {
    if (!party || !selectedProducts || selectedProducts.length === 0) {
      router.replace('/select-party');
      return;
    }
    loadAllVarieties();
  }, [productIdsKey, partyId]);

  const loadAllVarieties = async () => {
    if (selectedProducts.length === 0) {
      setVarietiesByProduct({});
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const newVarieties = {};
      
      // Fetch varieties for all selected products
      for (const product of selectedProducts) {
        const res = await productApi.getProductVarieties(product.id);
        if (res.success) {
          newVarieties[product.id] = res.data;
        } else {
          newVarieties[product.id] = [];
        }
      }
      
      setVarietiesByProduct(newVarieties);
    } catch (error) {
      console.error('Failed to load varieties:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isVarietySelected = (varietyId) => {
    return selectedVarieties.some(v => v.id === varietyId);
  };

  const handleToggleVariety = (product, variety) => {
    const varietyObj = {
      id: variety.id,
      productId: product.id,
      productName: product.name,
      name: variety.name
    };
    toggleVariety(varietyObj);
  };

  const handleOpenAddModal = (product) => {
    setTargetProduct(product);
    setVarietyName('');
    setLocalName('');
    setDescription('');
    setNameError('');
    setFormError('');
    setIsModalVisible(true);
  };

  const handleSaveVariety = async () => {
    if (!varietyName.trim()) {
      setNameError('Variety name is required');
      return;
    }

    if (!targetProduct) return;

    setIsSaving(true);
    setFormError('');

    try {
      const res = await productApi.createVariety(targetProduct.id, {
        name: varietyName.trim(),
        local_name: localName.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (res.success && res.data) {
        const newVariety = res.data;
        // Add to local state
        setVarietiesByProduct(prev => ({
          ...prev,
          [targetProduct.id]: [...(prev[targetProduct.id] || []), newVariety]
        }));

        // Automatically select the new variety
        toggleVariety({
          id: newVariety.id,
          productId: targetProduct.id,
          productName: targetProduct.name,
          name: newVariety.name
        });

        setIsModalVisible(false);
      } else {
        setFormError(res.message || 'Failed to create variety');
      }
    } catch (err) {
      setFormError(err.message || 'Network error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectRegular = () => {
    setIsModeModalVisible(false);
    setTransactionMode('REGULAR');
    router.push('/transaction/calculator');
  };

  const handleSelectFast = () => {
    setIsModeModalVisible(false);
    setTransactionMode('FAST');
    router.push('/transaction/fast-calculator');
  };

  return (
    <ScreenContainer>
      
      {/* Transaction Summary Header */}
      <View className="bg-card rounded-2xl border border-border p-5 mb-6 shadow-sm elevation-1">
        <View className="py-1">
          <Text className="text-[12px] font-bold text-textSecondary tracking-[1px] uppercase mb-1">Transaction With</Text>
          <Text className="text-[18px] font-extrabold text-primary">{party?.name || 'Unknown'}</Text>
        </View>
        <View className="h-[1px] bg-border my-2" />
        <View className="py-1">
          <Text className="text-[12px] font-bold text-textSecondary tracking-[1px] uppercase mb-1">Selected Products</Text>
          <Text className="text-[16px] font-bold text-textMain" numberOfLines={1}>
            {selectedProducts.map(p => p.name).join(' • ') || 'None'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="pb-8" showsVerticalScrollIndicator={false}>
        
        <Text className="text-[16px] font-bold text-textSecondary mb-6">Select all varieties present in this transaction</Text>

        {isLoading ? (
          <View className="py-8 justify-center items-center">
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : (
          selectedProducts.map((product) => {
            const availableVarieties = varietiesByProduct[product.id] || [];
          
          return (
            <View key={product.id} className="mb-8 bg-card/60 p-4 rounded-3xl border border-border/80">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[14px] font-extrabold text-textMain tracking-wide">{product.name.toUpperCase()}</Text>
                <TouchableOpacity 
                  className="flex-row items-center py-1.5 px-3 bg-emerald-50 rounded-xl border border-emerald-200"
                  onPress={() => handleOpenAddModal(product)}
                >
                  <Feather name="plus-circle" size={14} color="#10B981" />
                  <Text className="text-[12px] font-bold text-primary ml-1.5">Add Variety</Text>
                </TouchableOpacity>
              </View>

              {availableVarieties.length === 0 ? (
                <View className="py-4 items-center">
                  <Text className="text-[14px] text-textSecondary mb-2">No varieties registered for {product.name}</Text>
                  <TouchableOpacity
                    onPress={() => handleOpenAddModal(product)}
                    className="py-2 px-4 bg-primary/10 rounded-xl border border-primary/20"
                  >
                    <Text className="text-[13px] font-bold text-primary">+ Create First Variety</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                availableVarieties.map((variety) => {
                  const selected = isVarietySelected(variety.id);
                  return (
                    <TouchableOpacity 
                      key={variety.id}
                      className={`bg-card rounded-2xl p-4 mb-3 flex-row items-center border-[2px] shadow-sm elevation-1 ${selected ? 'border-primary bg-[#ECFDF5]' : 'border-border'}`}
                      onPress={() => handleToggleVariety(product, variety)}
                      activeOpacity={0.7}
                    >
                      <View className="flex-1">
                        <Text className={`text-[18px] ${selected ? 'text-primary font-bold' : 'text-textMain font-medium'}`}>
                          {variety.name}
                        </Text>
                      </View>
                      
                      <View className={`w-8 h-8 rounded-full border-[2px] items-center justify-center ${selected ? 'bg-primary border-primary' : 'bg-card border-border'}`}>
                        {selected && <Feather name="check" size={16} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          );
        }))}

      </ScrollView>

      <View className="pt-4 pb-2">
        <Button 
          title="CHOOSE TRANSACTION TYPE" 
          onPress={() => setIsModeModalVisible(true)} 
          type={isContinueDisabled ? 'secondary' : 'primary'}
          disabled={isContinueDisabled}
        />
      </View>

      {/* Transaction Mode Selection Modal */}
      <Modal
        visible={isModeModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsModeModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/60 p-5">
          <View className="bg-card w-full max-w-[420px] rounded-3xl p-6 border-2 border-border shadow-2xl">
            
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-border">
              <View>
                <Text className="text-[20px] font-extrabold text-textMain tracking-tight">SELECT TRANSACTION TYPE</Text>
                <Text className="text-[12px] font-medium text-textSecondary mt-0.5">Party: {party?.name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsModeModalVisible(false)}
                className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text className="text-[13px] font-medium text-textSecondary mb-5">
              Choose the transaction mode to proceed with:
            </Text>

            {/* Option 1: REGULAR TRANSACTION */}
            <TouchableOpacity
              onPress={handleSelectRegular}
              activeOpacity={0.8}
              className="bg-background rounded-2xl p-5 mb-4 border-2 border-border hover:border-primary active:bg-emerald-50/40"
            >
              <View className="flex-row items-center mb-2">
                <View className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 items-center justify-center mr-3">
                  <Feather name="layers" size={20} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-[18px] font-extrabold text-textMain">REGULAR</Text>
                    <View className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 border border-blue-200">
                      <Text className="text-[10px] font-bold text-blue-700">WEIGHING FLOW</Text>
                    </View>
                  </View>
                  <Text className="text-[12px] text-textSecondary mt-0.5">
                    Physical weighing → Submit weights → Apply rates later
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#64748B" />
              </View>
              <Text className="text-[11px] text-textSecondary/80 pl-14">
                Recommended when weighing bags one by one on the scale.
              </Text>
            </TouchableOpacity>

            {/* Option 2: FAST TRANSACTION */}
            <TouchableOpacity
              onPress={handleSelectFast}
              activeOpacity={0.8}
              className="bg-emerald-50/50 rounded-2xl p-5 mb-4 border-2 border-emerald-300 active:bg-emerald-100/60"
            >
              <View className="flex-row items-center mb-2">
                <View className="w-11 h-11 rounded-2xl bg-emerald-100 border border-emerald-300 items-center justify-center mr-3">
                  <Feather name="zap" size={20} color="#059669" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-[18px] font-extrabold text-emerald-800">FAST</Text>
                    <View className="ml-2 px-2 py-0.5 rounded-full bg-emerald-200 border border-emerald-300">
                      <Text className="text-[10px] font-bold text-emerald-800">QUICK ENTRY</Text>
                    </View>
                  </View>
                  <Text className="text-[12px] text-emerald-700 mt-0.5">
                    Date + Weight + Rate in single fast screen
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#059669" />
              </View>
              <Text className="text-[11px] text-emerald-700/80 pl-14">
                For historical/bulk entries with known weight and rate per kg.
              </Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              onPress={() => setIsModeModalVisible(false)}
              className="py-3 items-center"
            >
              <Text className="text-[13px] font-bold text-textSecondary">CANCEL</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* Add Variety Modal */}
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
              <View>
                <Text className="text-[20px] font-extrabold text-textMain">Add New Variety</Text>
                <Text className="text-[13px] font-medium text-textSecondary">Product: {targetProduct?.name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {formError ? (
                <View key="variety-form-error" className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex-row items-center">
                  <Feather name="alert-circle" size={18} color="#EF4444" />
                  <Text className="text-red-700 text-[13px] font-medium ml-2 flex-1">{formError}</Text>
                </View>
              ) : null}

              <InputField
                label="Variety Name *"
                placeholder="e.g. Sona Masoori / IR-64 / BPT 5204"
                value={varietyName}
                onChangeText={(text) => {
                  setVarietyName(text);
                  if (nameError) setNameError('');
                }}
                error={nameError}
              />

              <InputField
                label="Local Name (Optional)"
                placeholder="e.g. ಸೋನಾ ಮಸೂರಿ"
                value={localName}
                onChangeText={setLocalName}
              />

              <InputField
                label="Description (Optional)"
                placeholder="e.g. Premium fine grade"
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
                    onPress={handleSaveVariety}
                    disabled={isSaving}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
        
    </ScreenContainer>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, BackHandler, StyleSheet
} from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../../components/common/ScreenContainer';
import InputField from '../../components/common/InputField';
import { Feather } from '@expo/vector-icons';
import { useTransaction } from '../../context/TransactionContext';
import { productApi } from '../../api/services/productApi';

const styles = StyleSheet.create({
  keypadBtn: {
    marginHorizontal: 4,
    marginVertical: 4,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  keypadNormal: {
    backgroundColor: '#FFFFFF',
  },
  keypadSpecial: {
    backgroundColor: '#E2E8F0',
  },
  keypadText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  keypadSpecialText: {
    color: '#334155',
  },
});

const KeypadBtn = React.memo(function KeypadBtn({ label, onPress, isSpecial = false, flex = 1 }) {
  return (
    <TouchableOpacity
      style={[
        styles.keypadBtn,
        { flex },
        isSpecial ? styles.keypadSpecial : styles.keypadNormal,
      ]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      {label === '⌫' ? (
        <Feather name="delete" size={22} color="#0F172A" />
      ) : (
        <Text
          style={[
            styles.keypadText,
            isSpecial && styles.keypadSpecialText,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
});

export default function FastCalculator() {
  const {
    transactionState,
    addFastEntry,
    updateFastEntry,
    deleteFastEntry,
    clearFastEntries,
    addProduct,
    addVariety
  } = useTransaction();

  const { party, selectedProducts, selectedVarieties, fastEntries } = transactionState;

  // Form State
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [weight, setWeight] = useState('');
  const [rate, setRate] = useState('');
  const [activeInput, setActiveInput] = useState('WEIGHT'); // 'WEIGHT' | 'RATE'
  const [editingEntryId, setEditingEntryId] = useState(null);

  // Available varieties per product
  const [varietiesByProduct, setVarietiesByProduct] = useState({});
  const [isLoadingVarieties, setIsLoadingVarieties] = useState(false);

  // Custom Date Modal State
  const [isDatePickerModalVisible, setIsDatePickerModalVisible] = useState(false);
  const [customDateInput, setCustomDateInput] = useState('');
  const [dateError, setDateError] = useState('');

  // Form errors
  const [weightError, setWeightError] = useState('');
  const [rateError, setRateError] = useState('');

  // Product / Variety Management Modal State
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [modalTab, setModalTab] = useState('SELECT'); // 'SELECT' | 'NEW_PRODUCT' | 'NEW_VARIETY'
  const [allAvailableProducts, setAllAvailableProducts] = useState([]);
  const [isLoadingAllProducts, setIsLoadingAllProducts] = useState(false);
  const [targetProductForModal, setTargetProductForModal] = useState(null);
  const [modalVarieties, setModalVarieties] = useState([]);
  const [isLoadingModalVarieties, setIsLoadingModalVarieties] = useState(false);

  // Dynamic Product Form State
  const [newProductName, setNewProductName] = useState('');
  const [newProductLocalName, setNewProductLocalName] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [productFormError, setProductFormError] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Dynamic Variety Form State
  const [newVarietyName, setNewVarietyName] = useState('');
  const [newVarietyLocalName, setNewVarietyLocalName] = useState('');
  const [newVarietyDesc, setNewVarietyDesc] = useState('');
  const [varietyFormError, setVarietyFormError] = useState('');
  const [isSavingVariety, setIsSavingVariety] = useState(false);

  const scrollViewRef = useRef(null);

  // Hardware Back Button Protection
  useEffect(() => {
    const onBackPress = () => {
      if (isAddModalVisible) {
        setIsAddModalVisible(false);
        return true;
      }
      if (isDatePickerModalVisible) {
        setIsDatePickerModalVisible(false);
        return true;
      }
      if (fastEntries && fastEntries.length > 0) {
        Alert.alert(
          'Unsaved Entries',
          `You have ${fastEntries.length} entries recorded in this session. Leaving will discard these entries. Are you sure you want to leave?`,
          [
            { text: 'Stay', style: 'cancel' },
            {
              text: 'Leave (Discard)',
              style: 'destructive',
              onPress: () => {
                clearFastEntries();
                router.back();
              }
            }
          ]
        );
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isAddModalVisible, isDatePickerModalVisible, fastEntries?.length]);

  // Ensure party and products exist
  useEffect(() => {
    if (!party) {
      router.replace('/select-party');
      return;
    }
    if (!selectedProducts || selectedProducts.length === 0) {
      router.replace('/select-products');
      return;
    }

    // Set initial product & variety
    if (!selectedProduct && selectedProducts.length > 0) {
      setSelectedProduct(selectedProducts[0]);
    }
    loadVarieties();
  }, [party?.id]);

  // When selectedProduct changes, set default variety if needed
  useEffect(() => {
    if (selectedProduct) {
      const vars = varietiesByProduct[selectedProduct.id] || selectedVarieties.filter(v => v.productId === selectedProduct.id);
      if (vars.length > 0) {
        // If current selected variety doesn't belong to new product, switch to first variety
        if (!selectedVariety || selectedVariety.productId !== selectedProduct.id) {
          setSelectedVariety(vars[0]);
        }
      }
    }
  }, [selectedProduct, varietiesByProduct]);

  const loadVarieties = async () => {
    if (!selectedProducts || selectedProducts.length === 0) return;
    try {
      setIsLoadingVarieties(true);
      const varMap = {};
      for (const prod of selectedProducts) {
        const res = await productApi.getProductVarieties(prod.id);
        if (res.success && res.data) {
          varMap[prod.id] = res.data.map(v => ({
            id: v.id,
            productId: prod.id,
            productName: prod.name,
            name: v.name
          }));
        } else {
          varMap[prod.id] = selectedVarieties.filter(v => v.productId === prod.id);
        }
      }
      setVarietiesByProduct(varMap);

      // Set initial variety if none is selected
      const firstProd = selectedProduct || selectedProducts[0];
      if (!selectedVariety && varMap[firstProd.id]?.length > 0) {
        setSelectedVariety(varMap[firstProd.id][0]);
      }
    } catch (err) {
      console.error('Failed to load varieties:', err);
    } finally {
      setIsLoadingVarieties(false);
    }
  };

  // ----------------------------------------------------------------
  // Keypad Handlers
  // ----------------------------------------------------------------
  const handleKeypadPress = (val) => {
    if (activeInput === 'WEIGHT') {
      if (val === '.') {
        if (weight.includes('.')) return;
        setWeight(prev => (prev === '' ? '0.' : prev + '.'));
        if (weightError) setWeightError('');
        return;
      }
      // Max 2 decimal places
      if (weight.includes('.')) {
        const parts = weight.split('.');
        if (parts[1] && parts[1].length >= 2) return;
      }
      // Max 6 integer digits
      if (!weight.includes('.') && weight.length >= 6) return;

      setWeight(prev => (prev === '0' ? val : prev + val));
      if (weightError) setWeightError('');
    } else {
      if (val === '.') {
        if (rate.includes('.')) return;
        setRate(prev => (prev === '' ? '0.' : prev + '.'));
        if (rateError) setRateError('');
        return;
      }
      // Max 2 decimal places
      if (rate.includes('.')) {
        const parts = rate.split('.');
        if (parts[1] && parts[1].length >= 2) return;
      }
      // Max 6 integer digits
      if (!rate.includes('.') && rate.length >= 6) return;

      setRate(prev => (prev === '0' ? val : prev + val));
      if (rateError) setRateError('');
    }
  };

  const handleKeypadBackspace = () => {
    if (activeInput === 'WEIGHT') {
      setWeight(prev => prev.slice(0, -1));
    } else {
      setRate(prev => prev.slice(0, -1));
    }
  };

  const handleKeypadClear = () => {
    if (activeInput === 'WEIGHT') {
      setWeight('');
      setWeightError('');
    } else {
      setRate('');
      setRateError('');
    }
  };

  const handleToggleActiveInput = () => {
    setActiveInput(prev => (prev === 'WEIGHT' ? 'RATE' : 'WEIGHT'));
  };

  // ----------------------------------------------------------------
  // Modal Handlers
  // ----------------------------------------------------------------
  const handleOpenAddModal = async (initialTab = 'SELECT') => {
    setModalTab(initialTab);
    setIsAddModalVisible(true);
    setProductFormError('');
    setVarietyFormError('');
    setIsLoadingAllProducts(true);

    try {
      const res = await productApi.getProducts({ limit: 100 });
      if (res && res.data) {
        setAllAvailableProducts(res.data);
        const currentOrFirst = selectedProduct || res.data[0];
        if (currentOrFirst) {
          setTargetProductForModal(currentOrFirst);
          loadModalVarieties(currentOrFirst.id);
        }
      }
    } catch (e) {
      console.error('Failed to load all products:', e);
    } finally {
      setIsLoadingAllProducts(false);
    }
  };

  const loadModalVarieties = async (productId) => {
    setIsLoadingModalVarieties(true);
    try {
      const res = await productApi.getProductVarieties(productId);
      if (res && res.data) {
        setModalVarieties(res.data);
      } else {
        setModalVarieties([]);
      }
    } catch (e) {
      console.error('Failed to load modal varieties:', e);
      setModalVarieties([]);
    } finally {
      setIsLoadingModalVarieties(false);
    }
  };

  const handleSelectProductInModal = (product) => {
    setTargetProductForModal(product);
    loadModalVarieties(product.id);
  };

  const handleSelectVarietyFromModal = (variety) => {
    const varietyObj = {
      id: variety.id,
      productId: targetProductForModal.id,
      productName: targetProductForModal.name,
      name: variety.name
    };

    // Add to context and local state
    addProduct(targetProductForModal);
    addVariety(varietyObj);

    setVarietiesByProduct(prev => ({
      ...prev,
      [targetProductForModal.id]: [
        ...(prev[targetProductForModal.id] || []).filter(v => v.id !== variety.id),
        varietyObj
      ]
    }));

    setSelectedProduct(targetProductForModal);
    setSelectedVariety(varietyObj);
    setIsAddModalVisible(false);
  };

  const handleSaveNewProduct = async () => {
    const trimmed = newProductName.trim();
    if (!trimmed) {
      setProductFormError('Product category name is required');
      return;
    }

    setIsSavingProduct(true);
    setProductFormError('');
    try {
      const res = await productApi.createProduct({
        name: trimmed,
        local_name: newProductLocalName.trim() || undefined,
        description: newProductDesc.trim() || undefined
      });

      if (res && res.success && res.data) {
        const createdProd = res.data;
        addProduct(createdProd);
        setAllAvailableProducts(prev => [createdProd, ...prev]);
        setSelectedProduct(createdProd);
        setTargetProductForModal(createdProd);
        setModalVarieties([]);
        setNewProductName('');
        setNewProductLocalName('');
        setNewProductDesc('');
        // Automatically prompt to create first variety for this category
        setModalTab('NEW_VARIETY');
      } else {
        setProductFormError(res?.message || 'Failed to create product');
      }
    } catch (err) {
      setProductFormError(err?.message || 'Network error occurred');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSaveNewVariety = async () => {
    if (!targetProductForModal) {
      setVarietyFormError('Please select a parent product first');
      return;
    }
    const trimmed = newVarietyName.trim();
    if (!trimmed) {
      setVarietyFormError('Variety name is required');
      return;
    }

    setIsSavingVariety(true);
    setVarietyFormError('');
    try {
      const res = await productApi.createVariety(targetProductForModal.id, {
        name: trimmed,
        local_name: newVarietyLocalName.trim() || undefined,
        description: newVarietyDesc.trim() || undefined
      });

      if (res && res.success && res.data) {
        const createdVar = res.data;
        const varietyObj = {
          id: createdVar.id,
          productId: targetProductForModal.id,
          productName: targetProductForModal.name,
          name: createdVar.name
        };

        addProduct(targetProductForModal);
        addVariety(varietyObj);

        setVarietiesByProduct(prev => ({
          ...prev,
          [targetProductForModal.id]: [
            ...(prev[targetProductForModal.id] || []).filter(v => v.id !== createdVar.id),
            varietyObj
          ]
        }));

        setSelectedProduct(targetProductForModal);
        setSelectedVariety(varietyObj);
        setNewVarietyName('');
        setNewVarietyLocalName('');
        setNewVarietyDesc('');
        setIsAddModalVisible(false);
      } else {
        setVarietyFormError(res?.message || 'Failed to create variety');
      }
    } catch (err) {
      setVarietyFormError(err?.message || 'Network error occurred');
    } finally {
      setIsSavingVariety(false);
    }
  };

  // ----------------------------------------------------------------
  // Date Helpers
  // ----------------------------------------------------------------
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const adjustDateByDays = (days) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + days);
    setSelectedDate(dateObj.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleOpenCustomDatePicker = () => {
    setCustomDateInput(selectedDate);
    setDateError('');
    setIsDatePickerModalVisible(true);
  };

  const handleSaveCustomDate = () => {
    const trimmed = customDateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      setDateError('Please enter date in YYYY-MM-DD format (e.g. 2026-07-12)');
      return;
    }
    const [y, m, d] = trimmed.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) {
      setDateError('Invalid date provided.');
      return;
    }
    setSelectedDate(trimmed);
    setIsDatePickerModalVisible(false);
  };

  // ----------------------------------------------------------------
  // Calculated amount
  // ----------------------------------------------------------------
  const weightNum = parseFloat(weight) || 0;
  const rateNum = parseFloat(rate) || 0;
  const liveAmount = Math.round((weightNum * rateNum) * 100) / 100;

  // ----------------------------------------------------------------
  // Add / Update Entry
  // ----------------------------------------------------------------
  const handleSaveEntry = () => {
    let hasError = false;

    if (!weight || isNaN(weightNum) || weightNum <= 0) {
      setWeightError('Weight must be greater than 0 kg');
      hasError = true;
    } else {
      setWeightError('');
    }

    if (!rate || isNaN(rateNum) || rateNum <= 0) {
      setRateError('Rate is mandatory and must be greater than ₹0');
      hasError = true;
    } else {
      setRateError('');
    }

    if (!selectedProduct || !selectedVariety) {
      Alert.alert('Selection Missing', 'Please select a product and variety.');
      return;
    }

    if (hasError) return;

    if (editingEntryId) {
      // Update existing entry
      updateFastEntry(editingEntryId, {
        date: selectedDate,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        varietyId: selectedVariety.id,
        varietyName: selectedVariety.name,
        weight: weightNum,
        rate: rateNum
      });
      setEditingEntryId(null);
    } else {
      // Add new entry
      addFastEntry({
        date: selectedDate,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        varietyId: selectedVariety.id,
        varietyName: selectedVariety.name,
        weight: weightNum,
        rate: rateNum
      });
    }

    // Reset weight input and keep activeInput on WEIGHT for rapid entry
    setWeight('');
    setActiveInput('WEIGHT');
    setWeightError('');
    setRateError('');
  };

  const handleEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setSelectedDate(entry.date);
    
    // Find matching product
    const prod = selectedProducts.find(p => p.id === entry.productId) || { id: entry.productId, name: entry.productName };
    setSelectedProduct(prod);
    
    // Find matching variety
    setSelectedVariety({
      id: entry.varietyId,
      productId: entry.productId,
      productName: entry.productName,
      name: entry.varietyName
    });

    setWeight(String(entry.weight));
    setRate(String(entry.rate));
    setActiveInput('WEIGHT');
    setWeightError('');
    setRateError('');

    // Scroll to top
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setWeight('');
    setRate('');
    setActiveInput('WEIGHT');
    setWeightError('');
    setRateError('');
  };

  const handleDeleteEntry = (entry) => {
    Alert.alert(
      'Delete Entry',
      `Delete entry for ${entry.varietyName} (${entry.weight} kg @ ₹${entry.rate})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteFastEntry(entry.id);
            if (editingEntryId === entry.id) {
              handleCancelEdit();
            }
          }
        }
      ]
    );
  };

  // ----------------------------------------------------------------
  // Grouped History and Totals
  // ----------------------------------------------------------------
  const groupedEntriesByDate = fastEntries.reduce((acc, entry) => {
    if (!acc[entry.date]) acc[entry.date] = [];
    acc[entry.date].push(entry);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedEntriesByDate).sort();

  const grandTotalWeight = fastEntries.reduce((s, e) => s + (parseFloat(e.weight) || 0), 0);
  const grandTotalAmount = fastEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalEntriesCount = fastEntries.length;
  const totalDatesCount = sortedDates.length;

  const handleGoToReview = () => {
    if (fastEntries.length === 0) {
      Alert.alert('No Entries', 'Please add at least one entry before reviewing.');
      return;
    }
    router.push('/transaction/fast-review');
  };

  // Available varieties for active product
  const activeVarieties = (selectedProduct && varietiesByProduct[selectedProduct.id]) ||
    selectedVarieties.filter(v => v.productId === selectedProduct?.id) || [];

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerClassName="pb-12"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Banner */}
          <View className="bg-card rounded-2xl border-2 border-emerald-300 p-4 mb-3 shadow-sm elevation-1">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-emerald-100 items-center justify-center mr-2 border border-emerald-300">
                  <Feather name="zap" size={16} color="#059669" />
                </View>
                <View>
                  <Text className="text-[11px] font-extrabold text-emerald-700 tracking-wider uppercase">FAST TRANSACTION</Text>
                  <Text className="text-[18px] font-extrabold text-textMain" numberOfLines={1}>{party?.name}</Text>
                </View>
              </View>
              <View className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <Text className="text-[12px] font-extrabold text-emerald-700">
                  {totalEntriesCount} {totalEntriesCount === 1 ? 'Entry' : 'Entries'}
                </Text>
              </View>
            </View>
          </View>

          {/* ==================================================== */}
          {/* FAST ENTRY CALCULATOR CARD */}
          {/* ==================================================== */}
          <View className={`bg-card rounded-3xl border-2 p-4 mb-4 shadow-md elevation-2 ${editingEntryId ? 'border-amber-400 bg-amber-50/20' : 'border-border'}`}>
            
            {/* Calculator Card Title */}
            <View className="flex-row justify-between items-center mb-3 pb-2.5 border-b border-border">
              <View className="flex-row items-center">
                <Feather name={editingEntryId ? "edit-3" : "plus-circle"} size={17} color={editingEntryId ? "#D97706" : "#10B981"} />
                <Text className={`text-[15px] font-extrabold ml-2 ${editingEntryId ? 'text-amber-800' : 'text-textMain'}`}>
                  {editingEntryId ? 'EDIT ENTRY' : 'CALCULATOR ENTRY'}
                </Text>
              </View>
              {editingEntryId ? (
                <TouchableOpacity
                  key="cancel-edit-btn"
                  onPress={handleCancelEdit}
                  className="px-2.5 py-1 bg-slate-200 rounded-lg"
                >
                  <Text className="text-[11px] font-bold text-slate-700">CANCEL EDIT</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* 1. DATE SELECTION */}
            <View className="mb-3">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                  Date for this entry *
                </Text>
                <TouchableOpacity onPress={handleSetToday} className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                  <Text className="text-[10px] font-bold text-primary">Today</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center bg-background rounded-2xl border border-border p-1.5 justify-between">
                <TouchableOpacity
                  onPress={() => adjustDateByDays(-1)}
                  className="w-9 h-9 rounded-xl bg-card border border-border items-center justify-center active:bg-slate-100"
                >
                  <Feather name="chevron-left" size={18} color="#64748B" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleOpenCustomDatePicker}
                  activeOpacity={0.7}
                  className="flex-1 items-center py-0.5 mx-2"
                >
                  <View className="flex-row items-center">
                    <Feather name="calendar" size={14} color="#10B981" />
                    <Text className="text-[15px] font-extrabold text-textMain ml-1.5">
                      {formatDateDisplay(selectedDate)}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => adjustDateByDays(1)}
                  className="w-9 h-9 rounded-xl bg-card border border-border items-center justify-center active:bg-slate-100"
                >
                  <Feather name="chevron-right" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. PRODUCT (CATEGORY) SELECTION */}
            <View className="mb-3">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                  Product (Category) *
                </Text>
                <TouchableOpacity
                  onPress={() => handleOpenAddModal('NEW_PRODUCT')}
                  className="flex-row items-center px-2 py-0.5 bg-primary/10 rounded-lg border border-primary/20"
                >
                  <Feather name="plus" size={11} color="#10B981" />
                  <Text className="text-[10px] font-bold text-primary ml-1">+ New Category</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {selectedProducts.map(prod => {
                  const isSelected = selectedProduct?.id === prod.id;
                  return (
                    <TouchableOpacity
                      key={prod.id}
                      onPress={() => setSelectedProduct(prod)}
                      className={`mr-2 px-3.5 py-2 rounded-xl border-2 flex-row items-center ${isSelected ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                    >
                      <Feather name="box" size={13} color={isSelected ? '#FFFFFF' : '#64748B'} />
                      <Text className={`ml-1.5 text-[13px] font-extrabold ${isSelected ? 'text-white' : 'text-textMain'}`}>
                        {prod.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 3. VARIETY SELECTION */}
            <View className="mb-3">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                  Variety * ({selectedProduct?.name || 'Selected Product'})
                </Text>
                <TouchableOpacity
                  onPress={() => handleOpenAddModal('NEW_VARIETY')}
                  className="flex-row items-center px-2 py-0.5 bg-emerald-50 rounded-lg border border-emerald-200"
                >
                  <Feather name="plus-circle" size={11} color="#059669" />
                  <Text className="text-[10px] font-bold text-emerald-800 ml-1">+ New Variety</Text>
                </TouchableOpacity>
              </View>

              {activeVarieties.length === 0 ? (
                <View key="empty-varieties-box" className="py-2.5 px-3 bg-background rounded-xl border border-dashed border-emerald-300 items-center">
                  <Text className="text-[12px] text-textSecondary mb-1 text-center">
                    No varieties selected for {selectedProduct?.name}.
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleOpenAddModal('NEW_VARIETY')}
                    className="px-3 py-1 bg-emerald-600 rounded-lg flex-row items-center"
                  >
                    <Feather name="plus" size={12} color="#fff" />
                    <Text className="text-[11px] font-bold text-white ml-1">Create Variety for {selectedProduct?.name}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView key="active-varieties-list" horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {activeVarieties.map(v => {
                    const isSelected = selectedVariety?.id === v.id;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        onPress={() => setSelectedVariety(v)}
                        className={`mr-2 px-3.5 py-2 rounded-xl border-2 flex-row items-center ${isSelected ? 'bg-emerald-600 border-emerald-600 shadow-sm' : 'bg-background border-border'}`}
                      >
                        {isSelected ? <Feather name="check" size={13} color="#FFFFFF" className="mr-1" /> : null}
                        <Text className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-textMain'}`}>
                          {v.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* 4. DUAL DISPLAY BOXES (WEIGHT & RATE) */}
            <View className="flex-row gap-2.5 mb-2.5">
              {/* Weight Display Box */}
              <TouchableOpacity
                onPress={() => setActiveInput('WEIGHT')}
                activeOpacity={0.8}
                className={`flex-1 p-3 rounded-2xl border-2 ${
                  activeInput === 'WEIGHT' ? 'bg-primary/10 border-primary shadow-sm' : 'bg-background border-border'
                }`}
              >
                <View className="flex-row justify-between items-center mb-0.5">
                  <Text className={`text-[11px] font-black uppercase ${activeInput === 'WEIGHT' ? 'text-primary' : 'text-textSecondary'}`}>
                    Weight (kg)
                  </Text>
                  {activeInput === 'WEIGHT' ? (
                    <View key="weight-active-dot" className="w-2 h-2 rounded-full bg-primary" />
                  ) : null}
                </View>
                <View className="flex-row items-baseline justify-between">
                  <Text className="text-[26px] font-black text-textMain">
                    {weight || '0'}
                  </Text>
                  <Text className="text-[12px] font-bold text-textSecondary">kg</Text>
                </View>
                {weightError ? (
                  <Text key="weight-error-msg" className="text-[10px] font-bold text-red-600">{weightError}</Text>
                ) : null}
              </TouchableOpacity>

              {/* Rate Display Box */}
              <TouchableOpacity
                onPress={() => setActiveInput('RATE')}
                activeOpacity={0.8}
                className={`flex-1 p-3 rounded-2xl border-2 ${
                  activeInput === 'RATE' ? 'bg-emerald-50 border-emerald-600 shadow-sm' : 'bg-background border-border'
                }`}
              >
                <View className="flex-row justify-between items-center mb-0.5">
                  <Text className={`text-[11px] font-black uppercase ${activeInput === 'RATE' ? 'text-emerald-700' : 'text-textSecondary'}`}>
                    Rate (₹/kg)
                  </Text>
                  {activeInput === 'RATE' ? (
                    <View key="rate-active-dot" className="w-2 h-2 rounded-full bg-emerald-600" />
                  ) : null}
                </View>
                <View className="flex-row items-baseline justify-between">
                  <Text className="text-[26px] font-black text-emerald-700">
                    ₹{rate || '0'}
                  </Text>
                  <Text className="text-[12px] font-bold text-textSecondary">/kg</Text>
                </View>
                {rateError ? (
                  <Text key="rate-error-msg" className="text-[10px] font-bold text-red-600">{rateError}</Text>
                ) : null}
              </TouchableOpacity>
            </View>

            {/* Line Total Summary */}
            <View className="bg-slate-100 dark:bg-slate-800 rounded-xl p-2.5 mb-3 border border-border flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Feather name="activity" size={13} color="#10B981" />
                <Text className="text-[12px] font-bold text-textSecondary ml-1.5">
                  {selectedProduct?.name || 'Product'} / {selectedVariety?.name || 'Variety'}
                </Text>
              </View>
              <Text className="text-[15px] font-black text-emerald-700">
                Line Total: ₹{liveAmount.toLocaleString('en-IN')}
              </Text>
            </View>

            {/* ==================================================== */}
            {/* BUILT-IN ON-SCREEN CALCULATOR KEYPAD */}
            {/* ==================================================== */}
            <View className="bg-background/80 p-2 rounded-2xl border border-border mb-3">
              <View className="flex-row justify-between">
                {/* 3-Column Numeric Grid */}
                <View className="flex-[3.2] mr-1">
                  {/* Row 1: 1, 2, 3 */}
                  <View className="flex-row">
                    <KeypadBtn label="1" onPress={() => handleKeypadPress('1')} />
                    <KeypadBtn label="2" onPress={() => handleKeypadPress('2')} />
                    <KeypadBtn label="3" onPress={() => handleKeypadPress('3')} />
                  </View>

                  {/* Row 2: 4, 5, 6 */}
                  <View className="flex-row">
                    <KeypadBtn label="4" onPress={() => handleKeypadPress('4')} />
                    <KeypadBtn label="5" onPress={() => handleKeypadPress('5')} />
                    <KeypadBtn label="6" onPress={() => handleKeypadPress('6')} />
                  </View>

                  {/* Row 3: 7, 8, 9 */}
                  <View className="flex-row">
                    <KeypadBtn label="7" onPress={() => handleKeypadPress('7')} />
                    <KeypadBtn label="8" onPress={() => handleKeypadPress('8')} />
                    <KeypadBtn label="9" onPress={() => handleKeypadPress('9')} />
                  </View>

                  {/* Row 4 (Last Row): . , 0 , ⌫ */}
                  <View className="flex-row">
                    <KeypadBtn label="." onPress={() => handleKeypadPress('.')} isSpecial={true} />
                    <KeypadBtn label="0" onPress={() => handleKeypadPress('0')} />
                    <KeypadBtn label="⌫" onPress={handleKeypadBackspace} isSpecial={true} />
                  </View>
                </View>

                {/* 1-Column Action Column */}
                <View className="flex-[1.2] ml-1 flex-col justify-between">
                  {/* Switch Field (Weight ⇄ Rate) */}
                  <TouchableOpacity
                    onPress={handleToggleActiveInput}
                    className="flex-1 mx-1 my-1 rounded-2xl items-center justify-center bg-indigo-50 border-2 border-indigo-200 active:bg-indigo-100"
                  >
                    <Feather name="repeat" size={18} color="#4F46E5" />
                    <Text className="text-[11px] font-black text-indigo-700 uppercase mt-1 text-center">
                      {activeInput === 'WEIGHT' ? 'To Rate' : 'To Wt'}
                    </Text>
                  </TouchableOpacity>

                  {/* Clear Button */}
                  <TouchableOpacity
                    onPress={handleKeypadClear}
                    className="flex-1 mx-1 my-1 rounded-2xl items-center justify-center bg-slate-200 dark:bg-slate-800 border-2 border-border active:bg-slate-300"
                  >
                    <Text className="text-[16px] font-black text-slate-700 dark:text-slate-200">C</Text>
                  </TouchableOpacity>

                  {/* Enter / Save Entry Button */}
                  <TouchableOpacity
                    onPress={handleSaveEntry}
                    className={`flex-[2] mx-1 my-1 rounded-2xl items-center justify-center border-2 shadow-md ${
                      editingEntryId ? 'bg-amber-500 border-amber-600' : 'bg-primary border-emerald-600'
                    }`}
                  >
                    <Feather name="check" size={24} color="#FFFFFF" />
                    <Text className="text-[12px] font-black text-white uppercase mt-1 text-center tracking-wider">
                      {editingEntryId ? 'UPDATE' : 'ENTER'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

          </View>

          {/* ==================================================== */}
          {/* HISTORY SECTION (Grouped by Date) */}
          {/* ==================================================== */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center">
                <Feather name="list" size={16} color="#64748B" />
                <Text className="text-[15px] font-black text-textMain ml-2">
                  Session Entries ({fastEntries.length})
                </Text>
              </View>
              {fastEntries.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Clear All',
                      'Are you sure you want to clear all fast entries for this session?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear All', style: 'destructive', onPress: clearFastEntries }
                      ]
                    );
                  }}
                  className="px-2.5 py-1 bg-red-50 rounded-lg border border-red-200"
                >
                  <Text className="text-[11px] font-bold text-red-600">Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {fastEntries.length === 0 ? (
              <View className="p-8 bg-card rounded-3xl border border-dashed border-border items-center">
                <Feather name="file-text" size={32} color="#94A3B8" />
                <Text className="text-textSecondary text-[14px] font-bold mt-2">No entries yet</Text>
                <Text className="text-textSecondary text-[12px] text-center mt-1">
                  Use keypad to enter weight and rate, then tap Enter.
                </Text>
              </View>
            ) : (
              sortedDates.map((dateKey) => {
                const entriesForDate = groupedEntriesByDate[dateKey] || [];
                const dayWeight = entriesForDate.reduce((s, e) => s + (parseFloat(e.weight) || 0), 0);
                const dayAmount = entriesForDate.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

                return (
                  <View key={dateKey} className="bg-card rounded-3xl border border-border p-4 mb-4 shadow-sm">
                    {/* Date Subheader */}
                    <View className="flex-row justify-between items-center pb-2.5 mb-2.5 border-b border-border">
                      <View className="flex-row items-center">
                        <Feather name="calendar" size={14} color="#10B981" />
                        <Text className="text-[14px] font-black text-textMain ml-2">
                          {formatDateDisplay(dateKey)}
                        </Text>
                        <Text className="text-[11px] font-bold text-textSecondary ml-2">
                          ({entriesForDate.length} {entriesForDate.length === 1 ? 'entry' : 'entries'})
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-[13px] font-black text-emerald-700">
                          ₹{Math.round(dayAmount * 100 / 100).toLocaleString('en-IN')}
                        </Text>
                        <Text className="text-[10px] font-bold text-textSecondary">
                          {dayWeight.toFixed(1)} kg
                        </Text>
                      </View>
                    </View>

                    {/* Entry Lines */}
                    {entriesForDate.map((entry, eIdx) => (
                      <View
                        key={entry.id || eIdx}
                        className={`flex-row items-center justify-between py-2 border-b border-border/50 last:border-b-0 ${editingEntryId === entry.id ? 'bg-amber-50 rounded-xl px-2' : ''}`}
                      >
                        <View className="flex-1 mr-2">
                          <View className="flex-row items-center">
                            <Text className="text-[13px] font-black text-textMain">{entry.varietyName}</Text>
                            <Text className="text-[11px] text-textSecondary ml-1.5">({entry.productName})</Text>
                          </View>
                          <Text className="text-[11px] text-textSecondary mt-0.5">
                            {entry.weight} kg × ₹{entry.rate}/kg
                          </Text>
                        </View>

                        <View className="items-end mr-3">
                          <Text className="text-[14px] font-black text-primary">
                            ₹{(parseFloat(entry.amount) || 0).toLocaleString('en-IN')}
                          </Text>
                        </View>

                        {/* Action Buttons */}
                        <View className="flex-row items-center gap-1.5">
                          <TouchableOpacity
                            onPress={() => handleEditEntry(entry)}
                            className="p-2 rounded-xl bg-background border border-border"
                          >
                            <Feather name="edit-2" size={13} color="#64748B" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteEntry(entry)}
                            className="p-2 rounded-xl bg-red-50 border border-red-200"
                          >
                            <Feather name="trash-2" size={13} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })
            )}
          </View>

          {/* TOTALS & REVIEW BUTTON */}
          {fastEntries.length > 0 && (
            <View className="bg-card rounded-3xl border-2 border-emerald-300 p-5 shadow-lg mb-6">
              <Text className="text-[11px] font-black text-emerald-800 uppercase tracking-widest mb-2 text-center">
                SESSION TOTALS ({totalDatesCount} {totalDatesCount === 1 ? 'Date' : 'Dates'})
              </Text>
              <View className="flex-row justify-between py-1.5 border-b border-border">
                <Text className="text-[13px] font-bold text-textSecondary">Total Weight:</Text>
                <Text className="text-[15px] font-black text-primary">{grandTotalWeight.toFixed(1)} kg</Text>
              </View>
              <View className="flex-row justify-between py-1.5">
                <Text className="text-[14px] font-bold text-textMain">Grand Total Amount:</Text>
                <Text className="text-[20px] font-black text-emerald-700">
                  ₹{Math.round(grandTotalAmount * 100 / 100).toLocaleString('en-IN')}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleGoToReview}
                activeOpacity={0.85}
                className="bg-emerald-600 py-4 rounded-2xl items-center mt-4 shadow-md flex-row justify-center"
              >
                <Text className="text-white font-black text-[16px] mr-2">REVIEW & CREATE BILL</Text>
                <Feather name="arrow-right" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ==================================================== */}
      {/* CUSTOM DATE PICKER MODAL */}
      {/* ==================================================== */}
      <Modal
        visible={isDatePickerModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDatePickerModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-4">
          <View className="bg-card w-full max-w-sm rounded-3xl p-6 border border-border shadow-2xl">
            <View className="flex-row items-center justify-between pb-3 border-b border-border mb-4">
              <View className="flex-row items-center gap-2">
                <Feather name="calendar" size={18} color="#10B981" />
                <Text className="text-[16px] font-black text-textMain">Set Entry Date</Text>
              </View>
              <TouchableOpacity onPress={() => setIsDatePickerModalVisible(false)}>
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <InputField
              label="Date (YYYY-MM-DD)"
              placeholder="e.g. 2026-09-14"
              value={customDateInput}
              onChangeText={setCustomDateInput}
              error={dateError}
            />

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => setIsDatePickerModalVisible(false)}
                className="flex-1 py-3 rounded-xl bg-background border border-border items-center"
              >
                <Text className="text-[13px] font-bold text-textSecondary">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveCustomDate}
                className="flex-1 py-3 rounded-xl bg-primary items-center"
              >
                <Text className="text-[13px] font-bold text-white">Set Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* ADD / CREATE PRODUCT & VARIETY MODAL */}
      {/* ==================================================== */}
      <Modal
        visible={isAddModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-card rounded-t-3xl p-6 border-t border-border max-h-[85%] shadow-2xl">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center pb-3 border-b border-border mb-3">
              <Text className="text-[18px] font-black text-textMain">
                {modalTab === 'SELECT'
                  ? 'Select Product & Variety'
                  : modalTab === 'NEW_PRODUCT'
                  ? 'Create New Category (Product)'
                  : 'Create New Variety'}
              </Text>
              <TouchableOpacity
                onPress={() => setIsAddModalVisible(false)}
                className="w-8 h-8 rounded-full bg-background items-center justify-center border border-border"
              >
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Modal Tabs Bar */}
            <View className="flex-row bg-background p-1 rounded-xl border border-border mb-4">
              <TouchableOpacity
                onPress={() => setModalTab('SELECT')}
                className={`flex-1 py-2 items-center rounded-lg ${modalTab === 'SELECT' ? 'bg-primary' : 'bg-transparent'}`}
              >
                <Text className={`text-[11px] font-bold ${modalTab === 'SELECT' ? 'text-white' : 'text-textSecondary'}`}>
                  Browse Existing
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setModalTab('NEW_PRODUCT')}
                className={`flex-1 py-2 items-center rounded-lg ${modalTab === 'NEW_PRODUCT' ? 'bg-primary' : 'bg-transparent'}`}
              >
                <Text className={`text-[11px] font-bold ${modalTab === 'NEW_PRODUCT' ? 'text-white' : 'text-textSecondary'}`}>
                  + New Category
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setModalTab('NEW_VARIETY')}
                className={`flex-1 py-2 items-center rounded-lg ${modalTab === 'NEW_VARIETY' ? 'bg-primary' : 'bg-transparent'}`}
              >
                <Text className={`text-[11px] font-bold ${modalTab === 'NEW_VARIETY' ? 'text-white' : 'text-textSecondary'}`}>
                  + New Variety
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* TAB 1: BROWSE / SELECT EXISTING */}
              {modalTab === 'SELECT' && (
                <View>
                  <Text className="text-[12px] font-bold text-textSecondary uppercase tracking-wider mb-2">
                    1. Select Product Category
                  </Text>
                  {isLoadingAllProducts ? (
                    <ActivityIndicator size="small" color="#10B981" className="py-4" />
                  ) : (
                    <View className="flex-row flex-wrap gap-2 mb-4">
                      {allAvailableProducts.map(prod => {
                        const isSelected = targetProductForModal?.id === prod.id;
                        return (
                          <TouchableOpacity
                            key={prod.id}
                            onPress={() => handleSelectProductInModal(prod)}
                            className={`border rounded-xl px-3.5 py-2 flex-row items-center ${isSelected ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                          >
                            <Feather name="box" size={12} color={isSelected ? '#fff' : '#64748B'} className="mr-1.5" />
                            <Text className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-textMain'}`}>
                              {prod.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {targetProductForModal && (
                    <View className="pt-3 border-t border-border">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-[12px] font-bold text-textSecondary uppercase tracking-wider">
                          2. Select Variety of {targetProductForModal.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setModalTab('NEW_VARIETY')}
                          className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200 flex-row items-center"
                        >
                          <Feather name="plus" size={10} color="#059669" />
                          <Text className="text-[10px] font-bold text-emerald-800 ml-1">+ New Variety</Text>
                        </TouchableOpacity>
                      </View>

                      {isLoadingModalVarieties ? (
                        <ActivityIndicator size="small" color="#10B981" className="py-4" />
                      ) : modalVarieties.length === 0 ? (
                        <View className="py-4 items-center bg-background rounded-2xl border border-dashed border-border mb-4">
                          <Text className="text-[13px] text-textSecondary mb-2">No varieties registered for {targetProductForModal.name}</Text>
                          <TouchableOpacity
                            onPress={() => setModalTab('NEW_VARIETY')}
                            className="px-3.5 py-1.5 bg-emerald-600 rounded-xl"
                          >
                            <Text className="text-[12px] font-bold text-white">+ Create Variety</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View className="flex-row flex-wrap gap-2 mb-6">
                          {modalVarieties.map(v => (
                            <TouchableOpacity
                              key={v.id}
                              onPress={() => handleSelectVarietyFromModal(v)}
                              className="border border-border bg-background rounded-xl px-4 py-2.5 flex-row items-center active:bg-primary/10"
                            >
                              <Feather name="check-circle" size={13} color="#10B981" className="mr-1.5" />
                              <Text className="text-[13px] font-bold text-textMain">{v.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* TAB 2: CREATE NEW PRODUCT */}
              {modalTab === 'NEW_PRODUCT' && (
                <View className="bg-background p-4 rounded-2xl border border-border">
                  <Text className="text-[14px] font-black text-textMain mb-2">Create New Product Category</Text>
                  {productFormError ? (
                    <View className="p-2.5 mb-2 bg-red-50 rounded-xl border border-red-200">
                      <Text className="text-[12px] text-red-600 font-bold">{productFormError}</Text>
                    </View>
                  ) : null}

                  <InputField
                    label="Product / Category Name *"
                    placeholder="e.g. Soyabean, Wheat, Corn"
                    value={newProductName}
                    onChangeText={setNewProductName}
                  />

                  <InputField
                    label="Local / Regional Name (Optional)"
                    placeholder="e.g. सोयाबीन / गहू"
                    value={newProductLocalName}
                    onChangeText={setNewProductLocalName}
                  />

                  <InputField
                    label="Description (Optional)"
                    placeholder="e.g. Commercial oilseed"
                    value={newProductDesc}
                    onChangeText={setNewProductDesc}
                  />

                  <TouchableOpacity
                    onPress={handleSaveNewProduct}
                    disabled={isSavingProduct}
                    className="bg-primary py-3 rounded-xl items-center mt-3 flex-row justify-center shadow-sm"
                  >
                    {isSavingProduct ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="check" size={15} color="#fff" className="mr-1.5" />
                        <Text className="text-white font-bold text-[14px]">Create Product & Add Varieties</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* TAB 3: CREATE NEW VARIETY */}
              {modalTab === 'NEW_VARIETY' && (
                <View className="bg-background p-4 rounded-2xl border border-border">
                  <Text className="text-[14px] font-black text-textMain mb-2">
                    Create New Variety {targetProductForModal ? `for ${targetProductForModal.name}` : ''}
                  </Text>
                  {varietyFormError ? (
                    <View className="p-2.5 mb-2 bg-red-50 rounded-xl border border-red-200">
                      <Text className="text-[12px] text-red-600 font-bold">{varietyFormError}</Text>
                    </View>
                  ) : null}

                  {/* Target Product Selector if multiple exist */}
                  <Text className="text-[12px] font-bold text-textSecondary uppercase tracking-wider mb-1.5">
                    Parent Product Category *
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-3">
                    {allAvailableProducts.map(p => {
                      const isSelected = targetProductForModal?.id === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => setTargetProductForModal(p)}
                          className={`mr-2 px-3 py-1.5 rounded-xl border ${isSelected ? 'bg-primary border-primary' : 'bg-card border-border'}`}
                        >
                          <Text className={`text-[12px] font-bold ${isSelected ? 'text-white' : 'text-textMain'}`}>
                            {p.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <InputField
                    label="Variety Name *"
                    placeholder="e.g. 1121, Grade A, Tukda"
                    value={newVarietyName}
                    onChangeText={setNewVarietyName}
                  />

                  <InputField
                    label="Local / Regional Name (Optional)"
                    placeholder="e.g. नंबर १"
                    value={newVarietyLocalName}
                    onChangeText={setNewVarietyLocalName}
                  />

                  <InputField
                    label="Description (Optional)"
                    placeholder="e.g. Premium quality"
                    value={newVarietyDesc}
                    onChangeText={setNewVarietyDesc}
                  />

                  <TouchableOpacity
                    onPress={handleSaveNewVariety}
                    disabled={isSavingVariety}
                    className="bg-emerald-600 py-3 rounded-xl items-center mt-3 flex-row justify-center shadow-sm"
                  >
                    {isSavingVariety ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Feather name="plus-circle" size={15} color="#fff" className="mr-1.5" />
                        <Text className="text-white font-bold text-[14px]">Create Variety & Select for Entry</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
}

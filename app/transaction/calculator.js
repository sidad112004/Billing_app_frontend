import { Feather } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { Alert, Modal, ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import ScreenContainer from '../../components/common/ScreenContainer';
import { useTransaction } from '../../context/TransactionContext';
import { transactionApi } from '../../api/services/transactionApi';

export default function Calculator() {
  const {
    transactionState,
    addWeightEntry,
    initializeBackendTransaction,
    addProductVarietiesToTransaction,
    setTransactionData,
  } = useTransaction();
  const { party, selectedVarieties, weightEntries, backendTransactionId, backendVarietyMap, pendingSync } = transactionState;

  // Active variety for weighing
  const [activeVariety, setActiveVariety] = useState(
    selectedVarieties.length > 0 ? selectedVarieties[0] : null
  );
  const [inputWeight, setInputWeight] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState(null);

  // Add Product/Variety modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedNewProduct, setSelectedNewProduct] = useState(null);
  const [availableVarieties, setAvailableVarieties] = useState([]);
  const [selectedNewVarieties, setSelectedNewVarieties] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isAddingVarieties, setIsAddingVarieties] = useState(false);

  // Live summary panel toggle
  const [showSummary, setShowSummary] = useState(false);

  // Auto-select first variety when varieties load (new tx or restored from backend)
  useEffect(() => {
    if (!activeVariety && selectedVarieties.length > 0) {
      setActiveVariety(selectedVarieties[0]);
    }
    // If active variety was removed, fallback to first
    if (activeVariety && !selectedVarieties.some(v => v.id === activeVariety.id)) {
      setActiveVariety(selectedVarieties.length > 0 ? selectedVarieties[0] : null);
    }
  }, [selectedVarieties]);

  useEffect(() => {
    if (!party) {
      router.replace('/select-party');
      return;
    }

    // NEW TRANSACTION: No backendTransactionId yet — initialize from scratch
    if (!backendTransactionId && !isInitializing) {
      setInitError(null);
      setIsInitializing(true);
      initializeBackendTransaction()
        .then(success => {
          if (!success) {
            setInitError('Could not connect to the server. Check that the backend is running and your device is on the same Wi-Fi network.');
          }
        })
        .catch(err => {
          setInitError(err?.message || 'Server connection failed. Please try again.');
        })
        .finally(() => setIsInitializing(false));
      return;
    }

    // CONTINUE WEIGHING: backendTransactionId is set but varietyMap is missing
    // This happens when operator opens an existing DRAFT transaction from party list
    if (backendTransactionId && !backendVarietyMap && !isInitializing) {
      setInitError(null);
      setIsInitializing(true);
      transactionApi.getTransaction(backendTransactionId)
        .then(res => {
          if (!res.success || !res.data) throw new Error(res.message || 'Failed to load transaction');

          const { products, totals } = res.data;
          const varietyMap = {};
          const restoredVarieties = [];
          const restoredWeights = [];

          (products || []).forEach(prod => {
            (prod.varieties || []).forEach(v => {
              // Build the backendVarietyMap: localVarietyId → backendTransactionVarietyId
              varietyMap[v.varietyId] = v.id; // tv.id is the transaction_variety UUID
              restoredVarieties.push({
                id: v.varietyId,
                name: v.name,
                productId: prod.productId,
                productName: prod.name,
              });
              // Restore weight entries into local context so summary/review works
              (v.weights || []).forEach(w => {
                restoredWeights.push({
                  id: w.id,
                  productId: prod.productId,
                  productName: prod.name,
                  varietyId: v.varietyId,
                  varietyName: v.name,
                  weight: parseFloat(w.weight),
                });
              });
            });
          });

          setTransactionData({
            backendVarietyMap: varietyMap,
            selectedVarieties: restoredVarieties,
            weightEntries: restoredWeights,
          });
        })
        .catch(err => {
          setInitError('Could not load existing transaction: ' + (err?.message || 'Unknown error'));
        })
        .finally(() => setIsInitializing(false));
    }
  }, [backendTransactionId, party]);

  // ----------------------------------------------------------------
  // Keypad handlers
  // ----------------------------------------------------------------
  const handleKeyPress = (val) => {
    if (val === '.') {
      if (inputWeight.includes('.')) return;
      if (inputWeight === '') { setInputWeight('0.'); return; }
    }
    if (inputWeight.includes('.')) {
      const parts = inputWeight.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }
    setInputWeight(prev => prev + val);
  };

  const handleBackspace = () => setInputWeight(prev => prev.slice(0, -1));

  // ----------------------------------------------------------------
  // Add weight
  // ----------------------------------------------------------------
  const handleAddWeight = async () => {
    const weightNum = parseFloat(inputWeight);

    if (!activeVariety) {
      Alert.alert('Error', 'Please select a variety first.');
      return;
    }
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight greater than zero.');
      return;
    }
    if (isInitializing) {
      Alert.alert('Please Wait', 'Still connecting to the server, please try again in a moment.');
      return;
    }
    if (!backendTransactionId || !backendVarietyMap) {
      Alert.alert('Not Ready', 'Transaction is not initialized. Please go back and try again.');
      return;
    }

    const tempId = `weight_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newEntry = {
      id: tempId,
      tempId,
      productId: activeVariety.productId,
      productName: activeVariety.productName,
      varietyId: activeVariety.id,
      varietyName: activeVariety.name,
      weight: weightNum
    };

    setInputWeight('');
    const txVarietyId = backendVarietyMap[activeVariety.id];

    try {
      if (!txVarietyId) throw new Error('Transaction Variety mapping missing');
      const res = await transactionApi.addWeightEntry(txVarietyId, { weight: weightNum });
      if (res.success) {
        newEntry.id = res.data.id;
        addWeightEntry(newEntry, false);
      } else {
        throw new Error(res.message);
      }
    } catch (error) {
      console.log('Adding to offline queue due to error:', error);
      addWeightEntry(newEntry, true);
    }
  };

  // ----------------------------------------------------------------
  // Live summary computed data
  // ----------------------------------------------------------------
  const grandTotal = useMemo(() =>
    weightEntries.reduce((sum, w) => sum + w.weight, 0), [weightEntries]);

  const groupedSummary = useMemo(() => {
    return weightEntries.reduce((acc, entry) => {
      if (!acc[entry.productName]) acc[entry.productName] = {};
      if (!acc[entry.productName][entry.varietyName]) acc[entry.productName][entry.varietyName] = [];
      acc[entry.productName][entry.varietyName].push(entry.weight);
      return acc;
    }, {});
  }, [weightEntries]);

  // ----------------------------------------------------------------
  // Add Product/Variety modal logic
  // ----------------------------------------------------------------
  const openAddModal = async () => {
    setShowAddModal(true);
    setSelectedNewProduct(null);
    setSelectedNewVarieties([]);
    setAvailableVarieties([]);
    setIsLoadingProducts(true);
    try {
      const { productApi } = await import('../../api/services/productApi');
      const res = await productApi.getProducts();
      if (res && res.data) {
        setAvailableProducts(res.data);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not load products.');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleSelectNewProduct = async (product) => {
    setSelectedNewProduct(product);
    setSelectedNewVarieties([]);
    setAvailableVarieties([]);
    setIsLoadingProducts(true);
    try {
      const { productApi } = await import('../../api/services/productApi');
      const res = await productApi.getProductVarieties(product.id);
      if (res && res.data) {
        // Filter out already selected varieties for this product
        const alreadySelected = selectedVarieties.filter(v => v.productId === product.id).map(v => v.id);
        setAvailableVarieties(res.data.filter(v => !alreadySelected.includes(v.id)));
      }
    } catch (e) {
      Alert.alert('Error', 'Could not load varieties.');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const toggleNewVariety = (variety) => {
    setSelectedNewVarieties(prev => {
      const exists = prev.some(v => v.id === variety.id);
      return exists ? prev.filter(v => v.id !== variety.id) : [...prev, variety];
    });
  };

  const handleAddVarieties = async () => {
    if (!selectedNewProduct || selectedNewVarieties.length === 0) {
      Alert.alert('Error', 'Please select a product and at least one variety.');
      return;
    }

    const newVarietyObjects = selectedNewVarieties.map(v => ({
      id: v.id,
      name: v.name,
      productId: selectedNewProduct.id,
      productName: selectedNewProduct.name,
    }));

    setIsAddingVarieties(true);
    try {
      const success = await addProductVarietiesToTransaction(newVarietyObjects);
      if (success) {
        setShowAddModal(false);
        // Set active variety to the first newly added one
        if (newVarietyObjects.length > 0) {
          setActiveVariety(newVarietyObjects[0]);
        }
      } else {
        Alert.alert('Error', 'Could not add varieties to the transaction. Please try again.');
      }
    } finally {
      setIsAddingVarieties(false);
    }
  };

  // ----------------------------------------------------------------
  // Group selected varieties by product
  // ----------------------------------------------------------------
  const varietiesByProduct = selectedVarieties.reduce((acc, v) => {
    if (!acc[v.productName]) acc[v.productName] = [];
    acc[v.productName].push(v);
    return acc;
  }, {});

  const KeypadButton = ({ label, onPress, isSpecial = false }) => (
    <TouchableOpacity
      className={`flex-1 mr-2 rounded-2xl items-center justify-center border-2 shadow-sm elevation-1 ${isSpecial ? 'bg-background border-border' : 'bg-card border-border'}`}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {label === '⌫' ? (
        <Feather name="delete" size={28} color="#0F172A" />
      ) : (
        <Text className="text-[34px] font-extrabold text-textMain">{label}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <Stack.Screen
        options={{
          headerTitle: isInitializing ? 'Connecting...' : initError ? 'Connection Failed' : 'Weighing Calculator',
          headerRight: () => (
            <TouchableOpacity
              className={`flex-row items-center border border-card rounded-xl px-4 py-1.5 ${weightEntries.length === 0 ? 'opacity-50' : ''}`}
              onPress={() => router.push('/transaction/summary')}
              disabled={weightEntries.length === 0}
            >
              <Feather name="edit" size={16} color="#FFFFFF" className="mr-2" />
              <Text className="text-[#FFFFFF] font-bold text-[14px] ml-1 tracking-widest">REVIEW</Text>
            </TouchableOpacity>
          )
        }}
      />
      <View className="flex-1 flex-col">

        {/* ---- Initializing Overlay ---- */}
        {isInitializing && (
          <View className="absolute inset-0 z-50 bg-background items-center justify-center px-8">
            <View className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 items-center justify-center mb-6">
              <ActivityIndicator size="large" color="#10B981" />
            </View>
            <Text className="text-[20px] font-extrabold text-textMain mb-2">Setting Up Transaction</Text>
            <Text className="text-[14px] text-textSecondary text-center leading-[22px]">
              Connecting to server and registering{'\n'}your products & varieties...
            </Text>
          </View>
        )}

        {/* ---- Init Error Screen ---- */}
        {initError && !isInitializing && (
          <View className="absolute inset-0 z-50 bg-background items-center justify-center px-8">
            <View className="w-20 h-20 rounded-full bg-red-50 border-2 border-red-200 items-center justify-center mb-6">
              <Feather name="wifi-off" size={36} color="#DC2626" />
            </View>
            <Text className="text-[22px] font-extrabold text-textMain mb-3">Connection Failed</Text>
            <Text className="text-[14px] text-textSecondary text-center leading-[22px] mb-8">
              {initError}
            </Text>
            <TouchableOpacity
              className="bg-primary py-4 px-8 rounded-2xl w-full items-center mb-3"
              onPress={() => {
                setInitError(null);
                setIsInitializing(true);
                initializeBackendTransaction()
                  .then(success => {
                    if (!success) setInitError('Still cannot reach the server. Make sure the backend is running.');
                  })
                  .catch(err => setInitError(err?.message || 'Connection failed.'))
                  .finally(() => setIsInitializing(false));
              }}
            >
              <Text className="text-white font-extrabold text-[16px] tracking-widest">RETRY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="py-3 px-6 rounded-2xl items-center"
              onPress={() => router.back()}
            >
              <Text className="text-textSecondary font-bold text-[14px]">Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Compact Party Header Card */}
        <View className="flex-row items-center bg-card p-3 rounded-2xl border border-border mb-3 shadow-sm elevation-1">
          <View className="w-10 h-10 bg-[#ECFDF5] rounded-full items-center justify-center mr-3 border border-[#D1FAE5]">
            <Feather name="briefcase" size={18} color="#10B981" />
          </View>
          <View className="flex-1">
            <Text className="text-[11px] font-bold text-textSecondary uppercase tracking-widest">Transaction With</Text>
            <Text className="text-[16px] font-extrabold text-primary">{party?.name || 'Unknown Party'}</Text>
          </View>
          {/* Live grand total badge */}
          {weightEntries.length > 0 && (
            <View className="bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5">
              <Text className="text-[11px] font-bold text-primary">{grandTotal.toFixed(1)} kg</Text>
              <Text className="text-[10px] text-textSecondary text-center">{weightEntries.length} bags</Text>
            </View>
          )}
        </View>

        {/* Variety Selector Row */}
        <View className="bg-card rounded-2xl border border-border px-3 py-2 mb-3 shadow-sm elevation-1">
          <ScrollView showsVerticalScrollIndicator={false}>
            {Object.entries(varietiesByProduct).map(([productName, varieties]) => (
              <View key={productName} className="flex-row items-center py-1.5 border-b border-border border-dashed last:border-b-0">
                <View className="w-7 h-7 bg-[#ECFDF5] rounded-full items-center justify-center mr-2">
                  <Feather name="box" size={12} color="#10B981" />
                </View>
                <Text className="w-[60px] text-[12px] font-bold text-textMain uppercase tracking-wider">{productName}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pr-2 flex-grow gap-2 ml-2">
                  {varieties.map((v) => {
                    const isActive = activeVariety?.id === v.id;
                    const bagCount = weightEntries.filter(w => w.varietyId === v.id).length;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        className={`border rounded-full py-1.5 px-3 items-center justify-center min-w-[65px] ${isActive ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                        onPress={() => {
                          if (activeVariety?.id !== v.id) {
                            setActiveVariety(v);
                            setInputWeight(''); // Clear display when switching variety
                          }
                        }}
                      >
                        <Text className={`text-[12px] font-bold ${isActive ? 'text-[#FFFFFF]' : 'text-textMain'}`}>{v.name}</Text>
                        {bagCount > 0 && (
                          <Text className={`text-[10px] font-medium ${isActive ? 'text-[#D1FAE5]' : 'text-textSecondary'}`}>{bagCount} bags</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ))}
          </ScrollView>

          {/* + Add Product/Variety button */}
          <TouchableOpacity
            className="flex-row items-center justify-center mt-2 py-1.5 border border-dashed border-primary/40 rounded-xl"
            onPress={openAddModal}
          >
            <Feather name="plus" size={14} color="#10B981" />
            <Text className="text-[12px] font-bold text-primary ml-1">Add Product / Variety</Text>
          </TouchableOpacity>
        </View>

        {/* Display Area — weight only, NO rate */}
        <View className="flex-row items-center justify-between bg-card rounded-2xl border-2 border-border mb-3 shadow-sm elevation-1 px-5 py-3 min-h-[70px]">
          <View className="flex-1 justify-center">
            {activeVariety ? (
              <View>
                <Text className="text-[11px] font-bold text-textSecondary uppercase tracking-widest mb-0.5">Entering weight for</Text>
                <Text className="text-[15px] font-extrabold text-primary">{activeVariety.productName} / {activeVariety.name}</Text>
              </View>
            ) : (
              <Text className="text-[13px] text-textSecondary italic">Select a variety above</Text>
            )}
          </View>
          <View className="flex-1 justify-center items-end">
            <Text className="text-[40px] font-extrabold text-textMain tracking-tight">
              {inputWeight ? inputWeight : '0'}
            </Text>
            <Text className="text-[13px] font-bold text-textSecondary -mt-1">kg</Text>
          </View>
        </View>

        {/* 4-Column Layout: Keypad + Action Column */}
        <View className="flex-[2.5] flex-row justify-between">

          <View className="flex-[3.5] mr-2">
            <View className="flex-1 flex-row justify-between mb-2">
              <KeypadButton label="1" onPress={() => handleKeyPress('1')} />
              <KeypadButton label="2" onPress={() => handleKeyPress('2')} />
              <KeypadButton label="3" onPress={() => handleKeyPress('3')} />
            </View>
            <View className="flex-1 flex-row justify-between mb-2">
              <KeypadButton label="4" onPress={() => handleKeyPress('4')} />
              <KeypadButton label="5" onPress={() => handleKeyPress('5')} />
              <KeypadButton label="6" onPress={() => handleKeyPress('6')} />
            </View>
            <View className="flex-1 flex-row justify-between mb-2">
              <KeypadButton label="7" onPress={() => handleKeyPress('7')} />
              <KeypadButton label="8" onPress={() => handleKeyPress('8')} />
              <KeypadButton label="9" onPress={() => handleKeyPress('9')} />
            </View>
            <View className="flex-1 flex-row justify-between mb-2">
              <KeypadButton label="." onPress={() => handleKeyPress('.')} isSpecial />
              <KeypadButton label="0" onPress={() => handleKeyPress('0')} />
              <KeypadButton label="⌫" onPress={handleBackspace} isSpecial />
            </View>
          </View>

          <View className="flex-1 flex-col justify-between">
            {/* VIEW ENTRIES / LIVE SUMMARY */}
            <TouchableOpacity
              className="flex-1 bg-card rounded-2xl items-center justify-center mb-2 border-2 border-border shadow-sm elevation-1"
              onPress={() => setShowSummary(true)}
            >
              <Feather name="list" size={18} color="#10B981" />
              <Text className="text-[11px] font-bold text-primary text-center mt-1">
                {pendingSync.length > 0 ? `SYNC\nPENDING` : 'SUMMARY'}
              </Text>
              <Text className="text-[11px] font-bold text-textSecondary text-center mt-0.5">({weightEntries.length})</Text>
            </TouchableOpacity>

            {/* EDIT ENTRIES */}
            <TouchableOpacity
              className="flex-1 bg-card rounded-2xl items-center justify-center mb-2 border-2 border-border shadow-sm elevation-1"
              onPress={() => router.push('/transaction/history')}
            >
              <Feather name="edit-2" size={18} color="#64748B" />
              <Text className="text-[11px] font-bold text-textSecondary text-center mt-1">EDIT</Text>
            </TouchableOpacity>

            {/* ADD WEIGHT — big primary button */}
            <TouchableOpacity
              className={`flex-[2] bg-primary rounded-2xl items-center justify-center mb-2 shadow-medium elevation-3 ${(!inputWeight || !activeVariety) ? 'opacity-60' : ''}`}
              onPress={handleAddWeight}
              disabled={!inputWeight || !activeVariety}
            >
              <Feather name="box" size={24} color="#FFFFFF" className="mb-2" />
              <Text className="text-[15px] font-extrabold text-[#FFFFFF] text-center tracking-widest">ADD{'\n'}WEIGHT</Text>
            </TouchableOpacity>
          </View>

        </View>

      </View>

      {/* ---- Live Weighing Summary Modal ---- */}
      <Modal
        visible={showSummary}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSummary(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-card rounded-t-3xl p-6 border-t border-border max-h-[80%]">
            <View className="flex-row justify-between items-center pb-3 border-b border-border mb-4">
              <Text className="text-[20px] font-extrabold text-textMain">Live Summary</Text>
              <TouchableOpacity
                onPress={() => setShowSummary(false)}
                className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {Object.entries(groupedSummary).length === 0 ? (
                <Text className="text-textSecondary text-center py-8 italic">No weights entered yet.</Text>
              ) : (
                Object.entries(groupedSummary).map(([productName, varieties]) => (
                  <View key={productName} className="mb-5">
                    <Text className="text-[16px] font-extrabold text-textMain uppercase tracking-widest mb-2">{productName}</Text>
                    {Object.entries(varieties).map(([varietyName, weights]) => {
                      const total = weights.reduce((s, w) => s + w, 0);
                      return (
                        <View key={varietyName} className="bg-background rounded-xl p-3 mb-2 border border-border">
                          <View className="flex-row justify-between items-center mb-1">
                            <Text className="text-[14px] font-bold text-primary">{varietyName}</Text>
                            <Text className="text-[13px] font-bold text-textSecondary">{weights.length} bags</Text>
                          </View>
                          <Text className="text-[13px] text-textSecondary mb-1">
                            {weights.map(w => `${w}`).join(' + ')} kg
                          </Text>
                          <Text className="text-[15px] font-extrabold text-primary">Total: {total.toFixed(2)} kg</Text>
                        </View>
                      );
                    })}
                  </View>
                ))
              )}

              {/* Grand total — weight only, NO amounts */}
              <View className="mt-2 pt-4 border-t-2 border-border flex-row justify-between items-center">
                <Text className="text-[15px] font-bold text-textSecondary uppercase tracking-widest">Grand Total</Text>
                <Text className="text-[26px] font-extrabold text-primary">{grandTotal.toFixed(2)} kg</Text>
              </View>
              <View className="flex-row justify-between items-center mt-1 mb-8">
                <Text className="text-[13px] font-bold text-textSecondary">Total Bags</Text>
                <Text className="text-[18px] font-extrabold text-textMain">{weightEntries.length}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ---- Add Product/Variety Modal ---- */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-card rounded-t-3xl p-6 border-t border-border max-h-[85%]">
            <View className="flex-row justify-between items-center pb-3 border-b border-border mb-4">
              <Text className="text-[20px] font-extrabold text-textMain">Add Product / Variety</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
              >
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {isLoadingProducts ? (
                <View className="py-10 items-center">
                  <ActivityIndicator size="large" color="#10B981" />
                  <Text className="text-textSecondary mt-2">Loading...</Text>
                </View>
              ) : (
                <>
                  {/* Step 1: Select Product */}
                  <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-wider mb-3">
                    1. Select Product
                  </Text>
                  <View className="flex-row flex-wrap gap-2 mb-5">
                    {availableProducts.map(product => {
                      const isSelected = selectedNewProduct?.id === product.id;
                      return (
                        <TouchableOpacity
                          key={product.id}
                          className={`border rounded-xl px-4 py-2 ${isSelected ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                          onPress={() => handleSelectNewProduct(product)}
                        >
                          <Text className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-textMain'}`}>{product.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Step 2: Select Varieties */}
                  {selectedNewProduct && (
                    <>
                      <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-wider mb-3">
                        2. Select Varieties for {selectedNewProduct.name}
                      </Text>
                      {availableVarieties.length === 0 ? (
                        <Text className="text-textSecondary italic mb-4">
                          All varieties of {selectedNewProduct.name} are already added.
                        </Text>
                      ) : (
                        <View className="flex-row flex-wrap gap-2 mb-6">
                          {availableVarieties.map(variety => {
                            const isSelected = selectedNewVarieties.some(v => v.id === variety.id);
                            return (
                              <TouchableOpacity
                                key={variety.id}
                                className={`border rounded-xl px-4 py-2 ${isSelected ? 'bg-primary border-primary' : 'bg-background border-border'}`}
                                onPress={() => toggleNewVariety(variety)}
                              >
                                {isSelected && <Feather name="check" size={12} color="#fff" />}
                                <Text className={`text-[13px] font-bold ${isSelected ? 'text-white' : 'text-textMain'}`}>{variety.name}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </>
                  )}

                  {/* Confirm button */}
                  <TouchableOpacity
                    className={`bg-primary py-4 rounded-2xl items-center mt-2 mb-6 ${(selectedNewVarieties.length === 0 || isAddingVarieties) ? 'opacity-50' : ''}`}
                    onPress={handleAddVarieties}
                    disabled={selectedNewVarieties.length === 0 || isAddingVarieties}
                  >
                    {isAddingVarieties ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-extrabold text-[15px] tracking-widest">
                        ADD {selectedNewVarieties.length > 0 ? `(${selectedNewVarieties.length}) ` : ''}VARIETIES & CONTINUE
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
}

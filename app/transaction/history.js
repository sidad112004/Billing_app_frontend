import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../../components/common/ScreenContainer';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import NumericKeypad from '../../components/transaction/NumericKeypad';
import { Feather } from '@expo/vector-icons';
import { useTransaction } from '../../context/TransactionContext';
import { transactionApi } from '../../api/services/transactionApi';

export default function History() {
  const { transactionState, deleteWeightEntry, updateWeightEntry, syncPendingWeights } = useTransaction();
  const { party, weightEntries, pendingSync } = transactionState;

  const [editingEntry, setEditingEntry] = useState(null);
  const [editInputValue, setEditInputValue] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (pendingSync.length > 0) {
      setIsSyncing(true);
      syncPendingWeights().finally(() => setIsSyncing(false));
    }
  }, []);

  // -------------------------------------------------------------
  // Data Grouping & Calculation
  // -------------------------------------------------------------
  const grandTotal = weightEntries.reduce((sum, w) => sum + w.weight, 0);

  const groupedEntries = weightEntries.reduce((acc, entry) => {
    if (!acc[entry.productName]) {
      acc[entry.productName] = {};
    }
    if (!acc[entry.productName][entry.varietyName]) {
      acc[entry.productName][entry.varietyName] = [];
    }
    acc[entry.productName][entry.varietyName].push(entry);
    return acc;
  }, {});

  // -------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------
  const handleDelete = (entry) => {
    Alert.alert(
      'Delete Entry',
      `Are you sure you want to delete the ${entry?.weight} kg entry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              if (entry.tempId || (entry.id && String(entry.id).startsWith('weight_'))) {
                deleteWeightEntry(entry.id);
                return;
              }
              const res = await transactionApi.deleteWeightEntry(entry.id);
              if (res.success) {
                deleteWeightEntry(entry.id);
              } else {
                throw new Error(res.message);
              }
            } catch (err) {
              Alert.alert('Delete Failed', err.message || 'Could not delete entry.');
            }
          }
        }
      ]
    );
  };

  const handleOpenEdit = (entry) => {
    setEditingEntry(entry);
    setEditInputValue(entry?.weight?.toString() || '0');
  };

  const handleCloseEdit = () => {
    setEditingEntry(null);
    setEditInputValue('');
  };

  const handleEditKeyPress = (val) => {
    if (val === '.') {
      if (editInputValue.includes('.')) return;
      if (editInputValue === '') {
        setEditInputValue('0.');
        return;
      }
    }
    
    if (editInputValue.includes('.')) {
      const parts = editInputValue.split('.');
      if (parts[1] && parts[1].length >= 2) return;
    }

    if (!editInputValue.includes('.') && editInputValue.length >= 6) return;

    setEditInputValue(prev => (prev === '0' && val !== '.' ? val : prev + val));
  };

  const handleEditBackspace = () => {
    setEditInputValue(prev => prev.slice(0, -1));
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;

    const weightNum = parseFloat(editInputValue);
    
    if (isNaN(weightNum) || weightNum <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight greater than zero.');
      return;
    }

    try {
      setIsUpdating(true);
      if (editingEntry.tempId || (editingEntry.id && String(editingEntry.id).startsWith('weight_'))) {
        updateWeightEntry(editingEntry.id, weightNum);
        handleCloseEdit();
        syncPendingWeights();
        return;
      }

      const res = await transactionApi.updateWeightEntry(editingEntry.id, { weight: weightNum });
      if (res.success) {
        updateWeightEntry(editingEntry.id, weightNum);
        handleCloseEdit();
      } else {
        throw new Error(res.message);
      }
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Could not update entry.');
    } finally {
      setIsUpdating(false);
    }
  };

  // -------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------
  if (weightEntries.length === 0) {
    return (
      <ScreenContainer>
        <View className="flex-1 justify-center">
          <EmptyState 
            icon="clipboard" 
            title="No weight entries yet" 
            description="Add weights from the calculator."
          />
          <View className="mt-8">
            <Button 
              title="BACK TO CALCULATOR" 
              onPress={() => router.back()} 
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {isSyncing && (
        <View className="bg-yellow-100 py-2 items-center border-b border-yellow-200">
          <Text className="text-yellow-800 text-xs font-bold uppercase">Syncing Offline Entries...</Text>
        </View>
      )}
      <View className="flex-1 px-1 mt-2">
        
        {/* Top Summary */}
        <View className="bg-card rounded-2xl border-2 border-border p-5 mb-6 shadow-sm elevation-1">
          <View className="flex-row justify-between py-1 items-center">
            <Text className="text-[14px] font-bold text-textSecondary uppercase tracking-wider">Party</Text>
            <Text className="text-[16px] font-extrabold text-textMain">{party?.name || 'Unknown'}</Text>
          </View>
          <View className="flex-row justify-between py-1 items-center">
            <Text className="text-[14px] font-bold text-textSecondary uppercase tracking-wider">Total Entries</Text>
            <Text className="text-[16px] font-extrabold text-textMain">{weightEntries.length}</Text>
          </View>
          <View className="h-[2px] bg-background my-3" />
          <View className="flex-row justify-between py-1 items-center">
            <Text className="text-[14px] font-bold text-textSecondary uppercase tracking-wider">Grand Total</Text>
            <Text className="text-[22px] font-extrabold text-primary">{grandTotal.toFixed(2)} kg</Text>
          </View>
        </View>

        {/* Grouped List */}
        <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
          {Object.entries(groupedEntries).map(([productName, varieties]) => (
            <View key={productName} className="mb-8">
              <Text className="text-[20px] font-bold text-textMain mb-4">{productName.toUpperCase()}</Text>
              
              {Object.entries(varieties).map(([varietyName, entries]) => {
                const varietyBags = entries.length;
                const varietyTotal = entries.reduce((sum, w) => sum + w.weight, 0);

                return (
                  <View key={varietyName} className="bg-card rounded-2xl border-2 border-border mb-4 overflow-hidden shadow-sm elevation-1">
                    
                    <View className="bg-background p-4 border-b-2 border-border">
                      <Text className="text-[16px] font-extrabold text-primary mb-1 uppercase tracking-wide">{varietyName}</Text>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-[14px] font-bold text-textSecondary">Bags: {varietyBags}</Text>
                        <Text className="text-[14px] font-bold text-textSecondary">Total: {varietyTotal.toFixed(2)} kg</Text>
                      </View>
                    </View>

                    {entries.map((entry, index) => (
                      <View key={entry?.id || index.toString()} className="flex-row items-center justify-between p-4 border-b border-border">
                        <View className="flex-row items-center w-28">
                          <Text className="text-[14px] font-bold text-textSecondary w-8">#{index + 1}</Text>
                          <Text className="text-[20px] font-bold text-textMain ml-1">{entry?.weight} <Text className="text-[14px]">kg</Text></Text>
                        </View>
                        <View className="flex-row">
                          <TouchableOpacity 
                            className="flex-row items-center py-2 px-3 rounded-xl ml-2 border bg-[#ECFDF5] border-[#10B981]"
                            onPress={() => handleOpenEdit(entry)}
                          >
                            <Feather name="edit-2" size={16} color="#059669" />
                            <Text className="text-[#059669] text-[12px] font-bold ml-1 uppercase">Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            className="flex-row items-center py-2 px-3 rounded-xl ml-2 border bg-[#FEF2F2] border-[#EF4444]"
                            onPress={() => handleDelete(entry)}
                          >
                            <Feather name="trash-2" size={16} color="#DC2626" />
                            <Text className="text-[#DC2626] text-[12px] font-bold ml-1 uppercase">Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>

      </View>

      {/* Edit Modal */}
      <Modal
        visible={!!editingEntry}
        transparent
        animationType="slide"
        onRequestClose={handleCloseEdit}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-lg p-6">
            
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-[24px] font-bold text-textMain">Edit Weight</Text>
              <TouchableOpacity onPress={handleCloseEdit} className="p-1">
                <Feather name="x" size={24} color="#2D3748" />
              </TouchableOpacity>
            </View>

            <View className="items-center bg-card rounded-md p-6 border border-primary mb-6">
              <Text className="text-[48px] font-bold text-primary">
                {editInputValue ? editInputValue : '0.00'} <Text className="text-[20px] text-textSecondary">kg</Text>
              </Text>
              {editingEntry && (
                <Text className="text-[12px] text-textSecondary mt-2">
                  {editingEntry.productName} • {editingEntry.varietyName}
                </Text>
              )}
            </View>

            <NumericKeypad onKeyPress={handleEditKeyPress} onBackspace={handleEditBackspace} />

            <View className="flex-row justify-between mt-2">
              <Button 
                title="CANCEL" 
                type="secondary"
                onPress={handleCloseEdit}
                className="flex-1" 
                disabled={isUpdating}
              />
              <View className="w-4" />
              <Button 
                title={isUpdating ? "SAVING..." : "SAVE"} 
                onPress={handleSaveEdit}
                disabled={!editInputValue || isUpdating}
                className="flex-1" 
              />
            </View>

          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
}

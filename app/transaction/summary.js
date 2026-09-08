import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../../components/common/ScreenContainer';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import { Feather } from '@expo/vector-icons';
import { useTransaction } from '../../context/TransactionContext';
import { transactionApi } from '../../api/services/transactionApi';

export default function TransactionSummary() {
  const { transactionState, resetTransaction } = useTransaction();
  const { party, weightEntries, backendTransactionId, pendingSync } = transactionState;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (weightEntries.length === 0) {
    return (
      <ScreenContainer>
        <View className="flex-1 justify-center">
          <EmptyState
            icon="file-text"
            title="No Weight Entries"
            description="You need to add weights before reviewing."
          />
          <View className="mt-8">
            <Button title="BACK TO CALCULATOR" onPress={() => router.back()} />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // ----------------------------------------------------------------
  // Data grouping — weight only (no rates/amounts)
  // ----------------------------------------------------------------
  const totalBags = weightEntries.length;
  const grandTotal = weightEntries.reduce((sum, w) => sum + w.weight, 0);

  const groupedData = weightEntries.reduce((acc, entry) => {
    if (!acc[entry.productName]) {
      acc[entry.productName] = { varieties: {}, productTotalWeight: 0 };
    }
    if (!acc[entry.productName].varieties[entry.varietyName]) {
      acc[entry.productName].varieties[entry.varietyName] = [];
    }
    acc[entry.productName].varieties[entry.varietyName].push(entry);
    acc[entry.productName].productTotalWeight += entry.weight;
    return acc;
  }, {});

  // ----------------------------------------------------------------
  // SUBMIT WEIGHTS → transitions DRAFT → RATE
  // ----------------------------------------------------------------
  const handleSubmitWeights = async () => {
    if (pendingSync && pendingSync.length > 0) {
      Alert.alert(
        'Sync Pending',
        'Some weights are not yet synced to the server. Please wait or go to Edit Weights to resolve them before submitting.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!backendTransactionId) {
      Alert.alert('Error', 'Transaction ID missing. Please restart the session.');
      return;
    }

    Alert.alert(
      'Submit Weights',
      'Are you sure all weighing is complete? The transaction will move to the RATE stage and weighing cannot be resumed without going back to DRAFT.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Weights',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              const res = await transactionApi.submitWeights(backendTransactionId);
              if (res.success) {
                setShowSuccess(true);
              } else {
                throw new Error(res.message || 'Could not submit weights');
              }
            } catch (err) {
              Alert.alert('Submit Failed', err.message || 'Server error. Please try again.');
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleSuccessContinue = () => {
    setShowSuccess(false);
    resetTransaction();
    // Navigate back to party transactions screen
    router.replace('/parties');
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>

        {/* Party + Summary Header */}
        <View className="bg-card rounded-2xl border-2 border-border p-5 mb-6 shadow-sm elevation-1">
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-wider">Party</Text>
            <Text className="text-[18px] font-extrabold text-primary">{party?.name}</Text>
          </View>
          <View className="h-[2px] bg-background my-3" />
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-wider">Total Bags</Text>
            <Text className="text-[20px] font-extrabold text-textMain">{totalBags}</Text>
          </View>
          <View className="flex-row justify-between items-center py-1">
            <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-wider">Total Weight</Text>
            <Text className="text-[20px] font-extrabold text-primary">{grandTotal.toFixed(2)} kg</Text>
          </View>
        </View>

        {/* Product → Variety → Individual Weights */}
        {Object.entries(groupedData).map(([productName, productData]) => (
          <View key={productName} className="mb-8">
            <Text className="text-[18px] font-extrabold text-textMain mb-4 uppercase tracking-widest ml-1">{productName}</Text>

            {Object.entries(productData.varieties).map(([varietyName, entries]) => {
              const varietyBags = entries.length;
              const varietyTotal = entries.reduce((sum, w) => sum + w.weight, 0);

              return (
                <View key={varietyName} className="bg-card rounded-2xl border-2 border-border p-5 mb-4 shadow-sm elevation-1">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-[17px] font-bold text-primary">{varietyName}</Text>
                    <TouchableOpacity
                      className="flex-row items-center bg-[#ECFDF5] px-3 py-1.5 rounded-full border border-[#10B981]"
                      onPress={() => router.push('/transaction/history')}
                    >
                      <Feather name="edit-2" size={12} color="#059669" />
                      <Text className="text-[10px] font-extrabold text-[#059669] ml-1 uppercase tracking-wide">EDIT</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Individual weights — each on its own line */}
                  <View className="bg-background p-3 rounded-xl mb-3 border border-border">
                    {entries.map((entry, idx) => (
                      <View key={entry.id || idx} className="flex-row items-center py-0.5">
                        <Text className="text-[12px] text-textSecondary w-8">#{idx + 1}</Text>
                        <Text className="text-[15px] font-bold text-textMain">{entry.weight} <Text className="text-[12px] font-medium text-textSecondary">kg</Text></Text>
                      </View>
                    ))}
                  </View>

                  <View className="flex-row justify-between items-center">
                    <Text className="text-[14px] font-bold text-textMain">{varietyBags} Bags</Text>
                    <Text className="text-[16px] font-bold text-primary">Total: {varietyTotal.toFixed(2)} kg</Text>
                  </View>
                </View>
              );
            })}

            <View className="flex-row justify-between items-center py-3 border-t-2 border-border mt-2 pr-2">
              <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-widest">{productName} Total</Text>
              <Text className="text-[20px] font-extrabold text-primary">{productData.productTotalWeight.toFixed(2)} kg</Text>
            </View>
          </View>
        ))}

        {/* Action Buttons */}
        <View className="mt-2 mb-4 px-1 gap-3">
          <Button
            title="+ ADD PRODUCT / VARIETY"
            type="secondary"
            onPress={() => router.push('/transaction/calculator')}
          />
          <Button
            title="EDIT WEIGHTS"
            type="secondary"
            onPress={() => router.push('/transaction/history')}
          />
        </View>

        {/* Grand Total + SUBMIT Banner */}
        <View className="bg-primary rounded-3xl p-8 border-4 border-[#34D399] shadow-medium elevation-3 mx-1 mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-[14px] font-bold text-[#D1FAE5] tracking-[1px]">TOTAL BAGS</Text>
            <Text className="text-[24px] font-extrabold text-card">{totalBags}</Text>
          </View>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-[14px] font-bold text-[#D1FAE5] tracking-[1px]">GRAND TOTAL (KG)</Text>
            <Text className="text-[32px] font-extrabold text-card tracking-tight">{grandTotal.toFixed(2)}</Text>
          </View>

          {/* Important notice */}
          <View className="bg-[#065F46] rounded-2xl p-3 mb-5">
            <Text className="text-[12px] text-[#A7F3D0] font-bold text-center leading-[18px]">
              ✓ Submitting weights marks weighing as complete.{'\n'}Rates will be applied separately.
            </Text>
          </View>

          <Button
            title={isSubmitting ? 'SUBMITTING...' : 'SUBMIT WEIGHTS'}
            onPress={handleSubmitWeights}
            className="bg-card border-none"
            type="secondary"
            disabled={isSubmitting}
          />
        </View>

      </ScrollView>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View className="flex-1 bg-[#0F172A]/70 justify-center items-center p-6">
          <View className="bg-card rounded-3xl p-8 items-center w-full shadow-medium">
            <View className="w-24 h-24 rounded-full bg-[#ECFDF5] items-center justify-center mb-6 shadow-sm border-[4px] border-[#34D399]">
              <Feather name="check" size={48} color="#10B981" />
            </View>
            <Text className="text-[28px] font-extrabold text-textMain mb-2 tracking-tight">Weights Submitted!</Text>
            <Text className="text-[15px] font-medium text-textSecondary text-center mb-2 leading-[22px]">
              Weighing is complete. The transaction has moved to the{' '}
              <Text className="font-extrabold text-primary">RATE</Text> stage.
            </Text>
            <Text className="text-[13px] text-textSecondary text-center mb-8 leading-[20px]">
              You can now apply rates from the party's transaction list.
            </Text>
            <TouchableOpacity
              className="bg-primary py-5 px-8 rounded-2xl w-full items-center shadow-sm elevation-2"
              onPress={handleSuccessContinue}
            >
              <Text className="text-[#FFFFFF] text-[18px] font-bold tracking-wide">GO TO PARTY LIST</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

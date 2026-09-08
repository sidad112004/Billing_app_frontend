import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
  TextInput, Modal, KeyboardAvoidingView, Platform
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ScreenContainer from '../../components/common/ScreenContainer';
import Button from '../../components/common/Button';
import { Feather } from '@expo/vector-icons';
import { transactionApi } from '../../api/services/transactionApi';

/**
 * Rate Entry Screen
 *
 * Shown when operator opens a RATE-status transaction.
 * Allows entering rate (₹/kg) for each variety.
 * Amounts are calculated live: totalWeight × rate.
 * "COMPLETE BILL" is enabled only when all varieties have rates.
 */
export default function RateEntry() {
  const { transactionId } = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [completedBill, setCompletedBill] = useState(null);

  const [transaction, setTransaction] = useState(null);
  const [products, setProducts] = useState([]); // array of { id, name, varieties: [...] }
  const [partyName, setPartyName] = useState('');

  // Map of transactionVarietyId → rate (string, for TextInput)
  const [rates, setRates] = useState({});

  useEffect(() => {
    if (!transactionId) {
      Alert.alert('Error', 'No transaction ID provided.');
      router.back();
      return;
    }
    loadTransaction();
  }, [transactionId]);

  const loadTransaction = async () => {
    try {
      setIsLoading(true);
      const res = await transactionApi.getTransaction(transactionId);
      if (!res.success) throw new Error(res.message || 'Failed to load transaction');

      const { transaction: tx, products: prods, totals } = res.data;
      setTransaction(tx);
      setPartyName(tx.party_name || '');
      setProducts(prods || []);

      // Initialize rates from saved backend values
      const savedRates = {};
      (prods || []).forEach(prod => {
        (prod.varieties || []).forEach(v => {
          if (v.rate !== null && v.rate !== undefined) {
            savedRates[v.id] = String(v.rate);
          }
        });
      });
      setRates(savedRates);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not load transaction data.');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------
  // Computed values
  // ----------------------------------------------------------------
  const allVarieties = products.flatMap(p =>
    p.varieties.filter(v => v.totalBags > 0)
  );

  const allHaveRates = allVarieties.every(v => {
    const r = parseFloat(rates[v.id]);
    return !isNaN(r) && r > 0;
  });

  const missingRateVarieties = allVarieties.filter(v => {
    const r = parseFloat(rates[v.id]);
    return isNaN(r) || r <= 0;
  });

  const grandTotalWeight = allVarieties.reduce((s, v) => s + (v.totalWeight || 0), 0);
  const grandTotalAmount = allVarieties.reduce((s, v) => {
    const r = parseFloat(rates[v.id]);
    return s + (isNaN(r) ? 0 : v.totalWeight * r);
  }, 0);

  // ----------------------------------------------------------------
  // Save rate on blur (auto-save)
  // ----------------------------------------------------------------
  const handleRateBlur = async (transactionVarietyId) => {
    const rateStr = rates[transactionVarietyId];
    const rateNum = parseFloat(rateStr);
    if (!rateStr || isNaN(rateNum) || rateNum <= 0) return;

    try {
      await transactionApi.setVarietyRate(transactionVarietyId, rateNum);
    } catch (err) {
      console.warn('Failed to save rate:', err);
    }
  };

  // ----------------------------------------------------------------
  // Complete Bill
  // ----------------------------------------------------------------
  const handleCompleteBill = async () => {
    if (!allHaveRates) {
      const names = missingRateVarieties.map(v => v.name).join(', ');
      Alert.alert('Rates Incomplete', `Please enter rates for: ${names}`);
      return;
    }

    // Save all rates first
    Alert.alert(
      'Complete Bill',
      `This will finalize the bill with a total amount of ₹${grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Bill',
          onPress: async () => {
            try {
              setIsCompleting(true);

              // Save all rates to backend first
              for (const variety of allVarieties) {
                const rateNum = parseFloat(rates[variety.id]);
                if (!isNaN(rateNum) && rateNum > 0) {
                  await transactionApi.setVarietyRate(variety.id, rateNum);
                }
              }

              // Finalize transaction → creates bill, moves to COMPLETED
              const res = await transactionApi.finalizeTransaction(transactionId);
              if (res.success) {
                setCompletedBill(res.data);
                setShowSuccess(true);
              } else {
                throw new Error(res.message || 'Could not complete bill');
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to complete the bill. Please try again.');
            } finally {
              setIsCompleting(false);
            }
          }
        }
      ]
    );
  };

  const handleSuccessNavigate = () => {
    setShowSuccess(false);
    if (completedBill?.billId) {
      router.replace({
        pathname: '/transaction/bill-preview',
        params: { billId: completedBill.billId }
      });
    } else {
      router.replace('/parties');
    }
  };

  // ----------------------------------------------------------------
  // Format helpers
  // ----------------------------------------------------------------
  const formatAmount = (amount) =>
    `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#10B981" />
          <Text className="text-textSecondary mt-3 font-medium">Loading transaction...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View className="bg-card rounded-2xl border-2 border-border p-5 mb-5 shadow-sm elevation-1">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-wider">Party</Text>
              <Text className="text-[18px] font-extrabold text-primary">{partyName}</Text>
            </View>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-wider">Transaction</Text>
              <Text className="text-[14px] font-bold text-textMain">{transaction?.transaction_number}</Text>
            </View>
            <View className="h-[1px] bg-border my-2" />
            <View className="flex-row justify-between items-center">
              <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-wider">Total Weight</Text>
              <Text className="text-[18px] font-extrabold text-primary">{grandTotalWeight.toFixed(2)} kg</Text>
            </View>
          </View>

          {/* Stage Indicator */}
          <View className="flex-row items-center bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5">
            <Feather name="tag" size={18} color="#D97706" />
            <View className="ml-3 flex-1">
              <Text className="text-[13px] font-extrabold text-amber-800 uppercase tracking-wider">Rate Entry Stage</Text>
              <Text className="text-[12px] text-amber-700 mt-0.5">Enter ₹/kg rate for each variety below</Text>
            </View>
          </View>

          {/* Missing rates warning */}
          {!allHaveRates && (
            <View className="flex-row items-center bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-5">
              <Feather name="alert-circle" size={16} color="#DC2626" />
              <Text className="text-[12px] font-bold text-red-700 ml-2 flex-1">
                Rate pending for: {missingRateVarieties.map(v => v.name).join(', ')}
              </Text>
            </View>
          )}

          {/* Products & Varieties Rate Entry */}
          {products.map((prod) => {
            const activeVarieties = prod.varieties.filter(v => v.totalBags > 0);
            if (activeVarieties.length === 0) return null;

            return (
              <View key={prod.id} className="mb-8">
                {/* Product heading */}
                <View className="flex-row items-center mb-3">
                  <View className="w-8 h-8 bg-primary/10 rounded-full items-center justify-center mr-2 border border-primary/20">
                    <Feather name="box" size={14} color="#10B981" />
                  </View>
                  <Text className="text-[18px] font-extrabold text-textMain uppercase tracking-widest">{prod.name}</Text>
                </View>

                {activeVarieties.map((variety) => {
                  const rateStr = rates[variety.id] || '';
                  const rateNum = parseFloat(rateStr);
                  const amount = isNaN(rateNum) ? 0 : variety.totalWeight * rateNum;
                  const hasRate = !isNaN(rateNum) && rateNum > 0;

                  return (
                    <View
                      key={variety.id}
                      className={`bg-card rounded-2xl border-2 p-5 mb-4 shadow-sm elevation-1 ${hasRate ? 'border-emerald-200' : 'border-amber-200'}`}
                    >
                      {/* Variety header */}
                      <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-[17px] font-bold text-primary">{variety.name}</Text>
                        {hasRate ? (
                          <View className="flex-row items-center bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
                            <Feather name="check-circle" size={12} color="#059669" />
                            <Text className="text-[11px] font-bold text-emerald-700 ml-1">RATE SET</Text>
                          </View>
                        ) : (
                          <View className="flex-row items-center bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                            <Feather name="clock" size={12} color="#D97706" />
                            <Text className="text-[11px] font-bold text-amber-700 ml-1">PENDING</Text>
                          </View>
                        )}
                      </View>

                      {/* Individual weight entries */}
                      <View className="bg-background p-3 rounded-xl mb-3 border border-border">
                        <Text className="text-[11px] font-bold text-textSecondary uppercase tracking-wider mb-2">Weight Entries</Text>
                        <View className="flex-row flex-wrap gap-1.5">
                          {(variety.weights || []).map((w, idx) => (
                            <View key={w.id || idx} className="bg-card border border-border rounded-lg px-2.5 py-1">
                              <Text className="text-[13px] font-bold text-textMain">{parseFloat(w.weight).toFixed(1)} kg</Text>
                            </View>
                          ))}
                        </View>
                        <View className="flex-row justify-between mt-3 pt-2 border-t border-border">
                          <Text className="text-[13px] font-bold text-textSecondary">{variety.totalBags} Bags</Text>
                          <Text className="text-[15px] font-extrabold text-primary">Total: {parseFloat(variety.totalWeight).toFixed(2)} kg</Text>
                        </View>
                      </View>

                      {/* Rate input */}
                      <View className="flex-row items-center mb-2">
                        <View className="flex-1">
                          <Text className="text-[11px] font-bold text-textSecondary uppercase tracking-wider mb-1.5">Rate (₹ per kg)</Text>
                          <View className={`flex-row items-center border-2 rounded-xl px-4 py-3 ${hasRate ? 'border-emerald-300 bg-emerald-50/50' : 'border-amber-300 bg-amber-50/50'}`}>
                            <Text className="text-[20px] font-bold text-textSecondary mr-2">₹</Text>
                            <TextInput
                              className="flex-1 text-[22px] font-extrabold text-textMain"
                              value={rateStr}
                              onChangeText={(val) => {
                                // Only allow numbers and one decimal point
                                const cleaned = val.replace(/[^0-9.]/g, '');
                                const parts = cleaned.split('.');
                                if (parts.length > 2) return;
                                setRates(prev => ({ ...prev, [variety.id]: cleaned }));
                              }}
                              onBlur={() => handleRateBlur(variety.id)}
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor="#94A3B8"
                            />
                            <Text className="text-[14px] font-bold text-textSecondary ml-1">/kg</Text>
                          </View>
                        </View>
                      </View>

                      {/* Calculated amount */}
                      <View className={`flex-row justify-between items-center mt-2 pt-3 border-t border-dashed ${hasRate ? 'border-emerald-200' : 'border-border'}`}>
                        <Text className="text-[14px] font-bold text-textSecondary">
                          {variety.totalWeight.toFixed(2)} kg × ₹{rateNum > 0 ? rateNum : '—'}/kg
                        </Text>
                        <Text className={`text-[18px] font-extrabold ${hasRate ? 'text-emerald-600' : 'text-textSecondary'}`}>
                          {hasRate ? formatAmount(amount) : '—'}
                        </Text>
                      </View>
                    </View>
                  );
                })}

                {/* Product subtotal */}
                {(() => {
                  const prodTotal = activeVarieties.reduce((s, v) => {
                    const r = parseFloat(rates[v.id]);
                    return s + (isNaN(r) ? 0 : v.totalWeight * r);
                  }, 0);
                  const prodWeight = activeVarieties.reduce((s, v) => s + v.totalWeight, 0);
                  return (
                    <View className="flex-row justify-between items-center py-3 border-t-2 border-border mt-1 pr-2">
                      <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-widest">{prod.name} Total</Text>
                      <View className="items-end">
                        <Text className="text-[18px] font-extrabold text-primary">{prodWeight.toFixed(2)} kg</Text>
                        {prodTotal > 0 && (
                          <Text className="text-[14px] font-bold text-emerald-600 mt-0.5">{formatAmount(prodTotal)}</Text>
                        )}
                      </View>
                    </View>
                  );
                })()}
              </View>
            );
          })}

          {/* Grand Total Banner */}
          <View className="bg-primary rounded-3xl p-8 border-4 border-[#34D399] shadow-medium elevation-3 mx-1 mb-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-[14px] font-bold text-[#D1FAE5] tracking-[1px]">TOTAL WEIGHT</Text>
              <Text className="text-[22px] font-extrabold text-card">{grandTotalWeight.toFixed(2)} kg</Text>
            </View>
            <View className="h-[1px] bg-[#34D399] mb-4 opacity-50" />
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-[14px] font-bold text-[#D1FAE5] tracking-[1px]">GRAND TOTAL</Text>
              <Text className="text-[34px] font-extrabold text-card tracking-tight">
                {grandTotalAmount > 0 ? `₹${grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
              </Text>
            </View>

            {!allHaveRates && (
              <View className="bg-[#065F46] rounded-2xl p-3 mb-4">
                <Text className="text-[12px] text-[#6EE7B7] font-bold text-center">
                  ⚠ Enter rates for all varieties to complete the bill
                </Text>
              </View>
            )}

            <TouchableOpacity
              className={`bg-card rounded-2xl py-4 items-center ${(!allHaveRates || isCompleting) ? 'opacity-60' : ''}`}
              onPress={handleCompleteBill}
              disabled={!allHaveRates || isCompleting}
            >
              {isCompleting ? (
                <ActivityIndicator color="#10B981" />
              ) : (
                <Text className="text-[16px] font-extrabold text-primary tracking-widest">COMPLETE BILL</Text>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View className="flex-1 bg-[#0F172A]/70 justify-center items-center p-6">
          <View className="bg-card rounded-3xl p-8 items-center w-full shadow-medium">
            <View className="w-24 h-24 rounded-full bg-[#ECFDF5] items-center justify-center mb-6 shadow-sm border-[4px] border-[#34D399]">
              <Feather name="check" size={48} color="#10B981" />
            </View>
            <Text className="text-[28px] font-extrabold text-textMain mb-2 tracking-tight">Bill Completed!</Text>
            {completedBill?.billNumber && (
              <Text className="text-[17px] font-bold text-primary mb-2">Bill #{completedBill.billNumber}</Text>
            )}
            <Text className="text-[15px] font-medium text-textSecondary text-center mb-2">
              Grand Total:{' '}
              <Text className="font-extrabold text-emerald-600">
                ₹{Number(completedBill?.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </Text>
            <Text className="text-[13px] text-textSecondary text-center mb-8">
              Transaction moved to COMPLETED. Payment status: UNPAID.
            </Text>
            <TouchableOpacity
              className="bg-primary py-5 px-8 rounded-2xl w-full items-center shadow-sm elevation-2"
              onPress={handleSuccessNavigate}
            >
              <Text className="text-[#FFFFFF] text-[18px] font-bold tracking-wide">VIEW BILL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

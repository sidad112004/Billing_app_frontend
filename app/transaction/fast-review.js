import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../../components/common/ScreenContainer';
import Button from '../../components/common/Button';
import { Feather } from '@expo/vector-icons';
import { useTransaction } from '../../context/TransactionContext';
import { transactionApi } from '../../api/services/transactionApi';

export default function FastReviewScreen() {
  const { transactionState, clearFastEntries, resetTransaction } = useTransaction();
  const { party, fastEntries } = transactionState;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Group entries by date
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

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const handleEditBack = () => {
    router.back();
  };

  const handleSubmitFastTransaction = async () => {
    if (fastEntries.length === 0) {
      Alert.alert('No Entries', 'Cannot submit empty transaction.');
      return;
    }

    Alert.alert(
      'Submit Fast Transaction',
      `This will generate ${totalDatesCount} separate date-wise bill(s) for a total of ₹${grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}. Confirm submission?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Submit',
          onPress: async () => {
            try {
              setIsSubmitting(true);

              const payload = {
                partyId: party.id,
                entries: fastEntries.map(e => ({
                  date: e.date,
                  productId: e.productId,
                  varietyId: e.varietyId,
                  weight: parseFloat(e.weight),
                  rate: parseFloat(e.rate)
                }))
              };

              const res = await transactionApi.createFastTransaction(payload);

              if (res.success && res.data) {
                setSubmissionResult(res.data);
                setShowSuccessModal(true);
              } else {
                throw new Error(res.message || 'Submission failed');
              }
            } catch (err) {
              Alert.alert('Submission Error', err.message || 'Could not submit fast transaction.');
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  const handleFinishAndGoToParty = () => {
    setShowSuccessModal(false);
    clearFastEntries();
    resetTransaction();
    router.replace({
      pathname: '/party-transactions',
      params: { partyId: party.id, partyName: party.name }
    });
  };

  const handleViewFirstBill = (billId) => {
    setShowSuccessModal(false);
    clearFastEntries();
    resetTransaction();
    router.replace({
      pathname: '/transaction/bill-preview',
      params: { billId }
    });
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerClassName="pb-12" showsVerticalScrollIndicator={false}>
        
        {/* Header Title */}
        <View className="bg-card rounded-2xl border-2 border-emerald-300 p-5 mb-5 shadow-sm elevation-1">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <View className="w-9 h-9 rounded-xl bg-emerald-100 items-center justify-center mr-2.5 border border-emerald-300">
                <Feather name="check-square" size={18} color="#059669" />
              </View>
              <View>
                <Text className="text-[11px] font-extrabold text-emerald-700 tracking-wider uppercase">REVIEW FAST TRANSACTION</Text>
                <Text className="text-[18px] font-extrabold text-textMain" numberOfLines={1}>{party?.name}</Text>
              </View>
            </View>
          </View>
          <Text className="text-[12px] text-textSecondary mt-1">
            Please verify the date-wise entries before final submission. Separate bills will be generated for each distinct date.
          </Text>
        </View>

        {/* Grand Total Summary Card */}
        <View className="bg-primary rounded-3xl p-6 border-4 border-[#34D399] shadow-medium elevation-3 mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <View className="items-center flex-1 border-r border-[#34D399]/40 pr-2">
              <Text className="text-[11px] font-bold text-[#D1FAE5] uppercase">Total Dates</Text>
              <Text className="text-[20px] font-extrabold text-card mt-0.5">{totalDatesCount}</Text>
            </View>
            <View className="items-center flex-1 border-r border-[#34D399]/40 px-2">
              <Text className="text-[11px] font-bold text-[#D1FAE5] uppercase">Total Entries</Text>
              <Text className="text-[20px] font-extrabold text-card mt-0.5">{totalEntriesCount}</Text>
            </View>
            <View className="items-center flex-1 pl-2">
              <Text className="text-[11px] font-bold text-[#D1FAE5] uppercase">Total Weight</Text>
              <Text className="text-[20px] font-extrabold text-card mt-0.5">{grandTotalWeight.toFixed(1)} kg</Text>
            </View>
          </View>

          <View className="h-[1px] bg-[#34D399] my-3 opacity-50" />

          <View className="flex-row justify-between items-center">
            <Text className="text-[14px] font-bold text-[#D1FAE5] tracking-[1px]">GRAND TOTAL</Text>
            <Text className="text-[32px] font-extrabold text-card tracking-tight">
              ₹{grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Date-wise Breakdown Title */}
        <Text className="text-[14px] font-extrabold text-textSecondary tracking-wider uppercase mb-3 px-1">
          DATE-WISE BILLING BREAKDOWN ({totalDatesCount} BILLS)
        </Text>

        {/* Date Breakdown Cards */}
        {sortedDates.map((dateKey, dateIdx) => {
          const entriesForDate = groupedEntriesByDate[dateKey] || [];
          const dateTotalWeight = entriesForDate.reduce((s, e) => s + (parseFloat(e.weight) || 0), 0);
          const dateTotalAmount = entriesForDate.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

          return (
            <View key={dateKey} className="bg-card rounded-3xl border-2 border-border p-5 mb-5 shadow-sm elevation-1">
              
              {/* Date Bill Header */}
              <View className="flex-row justify-between items-center pb-3 mb-3 border-b-2 border-dashed border-border">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-xl bg-slate-100 items-center justify-center mr-2 border border-slate-200">
                    <Feather name="file-text" size={15} color="#475569" />
                  </View>
                  <View>
                    <Text className="text-[11px] font-extrabold text-textSecondary uppercase">BILL #{dateIdx + 1} PROJECTION</Text>
                    <Text className="text-[16px] font-extrabold text-textMain">{formatDateDisplay(dateKey)}</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-[18px] font-extrabold text-emerald-700">
                    ₹{dateTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </Text>
                  <Text className="text-[12px] font-bold text-textSecondary">
                    {dateTotalWeight.toFixed(1)} kg • {entriesForDate.length} {entriesForDate.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>
              </View>

              {/* Items for this date */}
              {entriesForDate.map((entry, idx) => (
                <View
                  key={entry.id || idx}
                  className="bg-background rounded-2xl p-3 mb-2 border border-border/70 flex-row justify-between items-center"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-[14px] font-bold text-textMain">{entry.varietyName}</Text>
                    <Text className="text-[11px] text-textSecondary">{entry.productName}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[14px] font-extrabold text-emerald-600">
                      ₹{Number(entry.amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </Text>
                    <Text className="text-[11px] font-medium text-textSecondary">
                      {parseFloat(entry.weight).toFixed(1)} kg × ₹{entry.rate}/kg
                    </Text>
                  </View>
                </View>
              ))}

              {/* Subtotal Footer */}
              <View className="flex-row justify-between items-center pt-2 mt-1 border-t border-border/60">
                <Text className="text-[12px] font-bold text-textSecondary uppercase">Date Total</Text>
                <Text className="text-[13px] font-extrabold text-primary">
                  {dateTotalWeight.toFixed(1)} kg = ₹{dateTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </Text>
              </View>

            </View>
          );
        })}

        {/* Action Buttons */}
        <View className="gap-3 mt-3">
          <TouchableOpacity
            onPress={handleSubmitFastTransaction}
            disabled={isSubmitting}
            activeOpacity={0.8}
            className={`bg-primary py-4 rounded-2xl items-center flex-row justify-center shadow-md ${isSubmitting ? 'opacity-60' : ''}`}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check-circle" size={20} color="#FFFFFF" />
                <Text className="text-[16px] font-extrabold text-white ml-2 tracking-wider uppercase">
                  SUBMIT FAST TRANSACTION
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleEditBack}
            disabled={isSubmitting}
            className="bg-card border-2 border-border py-3.5 rounded-2xl items-center flex-row justify-center"
          >
            <Feather name="edit" size={16} color="#64748B" />
            <Text className="text-[14px] font-bold text-textSecondary ml-2">EDIT ENTRIES</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Submission Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={handleFinishAndGoToParty}>
        <View className="flex-1 bg-black/70 justify-center items-center p-5">
          <View className="bg-card rounded-3xl p-6 items-center w-full max-w-[420px] shadow-2xl">
            
            <View className="w-20 h-20 rounded-full bg-emerald-50 items-center justify-center mb-4 border-4 border-emerald-400 shadow-sm">
              <Feather name="check" size={40} color="#10B981" />
            </View>

            <Text className="text-[24px] font-extrabold text-textMain mb-1 tracking-tight text-center">
              Fast Transaction Completed!
            </Text>

            <Text className="text-[13px] font-medium text-textSecondary text-center mb-4">
              Successfully generated {submissionResult?.bills?.length || 0} date-wise bill(s) for {party?.name}.
            </Text>

            {/* Generated Bills List */}
            <View className="w-full bg-background rounded-2xl p-3 border border-border mb-5 max-h-[220px]">
              <ScrollView showsVerticalScrollIndicator={false}>
                {(submissionResult?.bills || []).map((b, idx) => (
                  <View
                    key={b.billId || idx}
                    className="flex-row justify-between items-center py-2.5 px-3 mb-1.5 bg-card rounded-xl border border-border/80"
                  >
                    <View>
                      <Text className="text-[14px] font-extrabold text-textMain">Bill #{b.billNumber}</Text>
                      <Text className="text-[11px] font-medium text-textSecondary">
                        {formatDateDisplay(b.date)} • {parseFloat(b.totalWeight || 0).toFixed(1)} kg
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[14px] font-extrabold text-emerald-600">
                        ₹{Number(b.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </Text>
                      <View className="px-2 py-0.5 bg-red-50 rounded border border-red-200 mt-0.5">
                        <Text className="text-[9px] font-extrabold text-red-700">UNPAID</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Total Banner */}
            <View className="w-full flex-row justify-between items-center py-2 px-3 bg-emerald-50 rounded-xl border border-emerald-200 mb-5">
              <Text className="text-[13px] font-bold text-emerald-900">Total Amount:</Text>
              <Text className="text-[17px] font-extrabold text-emerald-700">
                ₹{Number(submissionResult?.grandTotalAmount || grandTotalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>

            {/* Modal Buttons */}
            <View className="w-full gap-2.5">
              <TouchableOpacity
                className="bg-primary py-4 rounded-2xl w-full items-center shadow-sm"
                onPress={handleFinishAndGoToParty}
                activeOpacity={0.8}
              >
                <Text className="text-white text-[15px] font-extrabold tracking-wide uppercase">
                  VIEW COMPLETED BILLS
                </Text>
              </TouchableOpacity>

              {submissionResult?.bills?.length > 0 && (
                <TouchableOpacity
                  className="bg-card border-2 border-border py-3 rounded-2xl w-full items-center"
                  onPress={() => handleViewFirstBill(submissionResult.bills[0].billId)}
                  activeOpacity={0.8}
                >
                  <Text className="text-textSecondary text-[13px] font-bold">
                    VIEW FIRST BILL (#{submissionResult.bills[0].billNumber})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
}

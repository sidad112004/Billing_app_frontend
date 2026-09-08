import React, { useRef, useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ScreenContainer from '../../components/common/ScreenContainer';
import Button from '../../components/common/Button';
import { Feather } from '@expo/vector-icons';
import { transactionApi } from '../../api/services/transactionApi';

/**
 * Bill Preview Screen
 *
 * Shown after a transaction is COMPLETED (bill finalized).
 * Displays the complete bill with rates, amounts, and grand total.
 * Allows marking the bill as PAID.
 *
 * Accepts either:
 *  - billId param (direct bill ID)
 *  - transactionId param (looks up bill by transaction)
 */
export default function BillPreview() {
  const { billId, transactionId } = useLocalSearchParams();
  const viewRef = useRef(null);

  const [billData, setBillData] = useState(null);
  const [billItems, setBillItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  useEffect(() => {
    if (billId) {
      loadBillById(billId);
    } else if (transactionId) {
      loadBillByTransactionId(transactionId);
    } else {
      setIsLoading(false);
    }
  }, [billId, transactionId]);

  const loadBillById = async (id) => {
    try {
      setIsLoading(true);
      const res = await transactionApi.getBillById(id);
      if (res.success) {
        setBillData(res.data.bill);
        setBillItems(res.data.items);
      } else {
        throw new Error(res.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load bill data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBillByTransactionId = async (txId) => {
    try {
      setIsLoading(true);
      const res = await transactionApi.getBillByTransactionId(txId);
      if (res.success) {
        setBillData(res.data.bill);
        setBillItems(res.data.items);
      } else {
        throw new Error(res.message || 'Bill not found for this transaction');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load bill data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!billData?.id) return;
    Alert.alert(
      'Mark as Paid',
      `Are you sure you want to mark Bill #${billData.bill_number} as paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Paid',
          onPress: async () => {
            try {
              setIsMarkingPaid(true);
              const res = await transactionApi.markBillPaid(billData.id);
              if (res.success) {
                setBillData(prev => ({ ...prev, payment_status: 'PAID', paid_at: res.data.paid_at }));
                Alert.alert('Paid!', 'Bill has been marked as paid. Outstanding total updated.');
              } else {
                throw new Error(res.message);
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Could not mark bill as paid.');
            } finally {
              setIsMarkingPaid(false);
            }
          }
        }
      ]
    );
  };

  const handleGoBack = () => {
    router.replace('/parties');
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#10B981" />
          <Text className="mt-4 text-textSecondary font-bold">Loading Bill...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!billData) {
    return (
      <ScreenContainer>
        <View className="flex-1 justify-center items-center p-4">
          <View className="w-24 h-24 bg-[#FEF2F2] rounded-full items-center justify-center mb-6 shadow-sm border-[4px] border-[#FEE2E2]">
            <Feather name="alert-triangle" size={48} color="#EF4444" />
          </View>
          <Text className="text-[28px] font-extrabold text-textMain mt-2">Bill Not Found</Text>
          <Text className="text-[16px] font-medium text-textSecondary text-center mt-2 mb-8">
            Could not load bill data.
          </Text>
          <Button title="BACK TO PARTIES" onPress={handleGoBack} className="w-full" />
        </View>
      </ScreenContainer>
    );
  }

  // Prepare display data from backend bill
  const receiptNo = billData.bill_number;
  const currentDate = new Date(billData.bill_date || billData.created_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const displayPartyName = billData.party_name_snapshot;
  const displayTotalBags = billData.total_bags;
  const displayTotalWeight = parseFloat(billData.total_weight);
  const displayTotalAmount = parseFloat(billData.total_amount);
  const isPaid = billData.payment_status === 'PAID';

  // Group bill items by product
  const groupedItems = billItems.reduce((acc, item) => {
    const prodName = item.product_name_snapshot;
    if (!acc[prodName]) acc[prodName] = [];
    acc[prodName].push(item);
    return acc;
  }, {});

  const handleShare = () => Alert.alert('Share', 'Sharing functionality coming soon.');
  const handlePrint = () => Alert.alert('Print', 'Printing functionality coming soon.');

  return (
    <ScreenContainer>

      {/* Payment Status Banner */}
      {isPaid ? (
        <View className="flex-row items-center bg-emerald-50 border-2 border-emerald-200 rounded-2xl px-4 py-3 mb-4">
          <Feather name="check-circle" size={22} color="#059669" />
          <View className="ml-3">
            <Text className="text-[14px] font-extrabold text-emerald-700">PAID</Text>
            {billData.paid_at && (
              <Text className="text-[11px] text-emerald-600">
                Paid on {new Date(billData.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View className="flex-row items-center bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-3 mb-4">
          <Feather name="alert-circle" size={22} color="#DC2626" />
          <View className="ml-3 flex-1">
            <Text className="text-[14px] font-extrabold text-red-700">UNPAID</Text>
            <Text className="text-[11px] text-red-600">
              {`₹${displayTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} outstanding
            </Text>
          </View>
          <TouchableOpacity
            className={`bg-red-600 px-4 py-2 rounded-xl ${isMarkingPaid ? 'opacity-50' : ''}`}
            onPress={handleMarkPaid}
            disabled={isMarkingPaid}
          >
            {isMarkingPaid ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white font-extrabold text-[12px]">MARK PAID</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Top Actions */}
      <View className="flex-row justify-between mb-4">
        <TouchableOpacity
          className="flex-row items-center bg-card py-3 px-4 rounded-2xl border-2 border-border flex-1 mr-2 justify-center shadow-sm elevation-1"
          onPress={handleShare}
        >
          <Feather name="share-2" size={20} color="#10B981" />
          <Text className="text-[14px] font-extrabold text-primary ml-2 tracking-wide">SHARE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center bg-card py-3 px-4 rounded-2xl border-2 border-border flex-1 ml-2 justify-center shadow-sm elevation-1"
          onPress={handlePrint}
        >
          <Feather name="printer" size={20} color="#10B981" />
          <Text className="text-[14px] font-extrabold text-primary ml-2 tracking-wide">PRINT</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>

        {/* Bill Container */}
        <View
          ref={viewRef}
          className="bg-[#FDFDFC] rounded-xl border-2 border-border p-6 shadow-medium elevation-2 mb-6 mx-1"
        >
          {/* Bill Header */}
          <View className="items-center border-b-2 border-dashed border-border pb-5 mb-5">
            <Text className="text-[28px] font-extrabold text-textMain tracking-widest uppercase">Bhavani Traders</Text>
            <Text className="text-[14px] font-medium text-textSecondary mt-2 tracking-wide">APMC Market, Yard No 1</Text>
            <Text className="text-[14px] font-medium text-textSecondary mt-1 tracking-wide">Phone: +91 98765 43210</Text>
          </View>

          {/* Bill Details */}
          <View className="border-b-2 border-dashed border-border pb-5 mb-5">
            <View className="flex-row justify-between py-1 mb-1">
              <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-widest">Receipt No:</Text>
              <Text className="text-[13px] font-extrabold text-textMain">{receiptNo}</Text>
            </View>
            <View className="flex-row justify-between py-1 mb-3">
              <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-widest">Date:</Text>
              <Text className="text-[13px] font-bold text-textMain">{currentDate}</Text>
            </View>
            <View className="flex-row justify-between py-1 items-center mb-1">
              <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-widest">Party:</Text>
              <Text className="text-[20px] font-extrabold text-primary">{displayPartyName}</Text>
            </View>
            {/* Payment Status on bill */}
            <View className="flex-row justify-between py-1 items-center">
              <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-widest">Payment:</Text>
              <View className={`px-3 py-1 rounded-full border ${isPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <Text className={`text-[12px] font-extrabold ${isPaid ? 'text-emerald-700' : 'text-red-700'}`}>
                  {isPaid ? '✓ PAID' : 'UNPAID'}
                </Text>
              </View>
            </View>
          </View>

          {/* Items Table */}
          <View className="mb-6">
            {/* Table Header */}
            <View className="flex-row justify-between border-b-2 border-border pb-3 mb-3">
              <Text className="flex-[2] text-[12px] font-bold text-textSecondary uppercase tracking-widest">Item</Text>
              <Text className="flex-1 text-[12px] font-bold text-textSecondary text-right uppercase tracking-widest">Bags</Text>
              <Text className="flex-[1.2] text-[12px] font-bold text-textSecondary text-right uppercase tracking-widest">Weight</Text>
              <Text className="flex-[1.5] text-[12px] font-bold text-textSecondary text-right uppercase tracking-widest">Amount</Text>
            </View>

            {/* Table Rows grouped by product */}
            {Object.entries(groupedItems).map(([productName, items]) => {
              const productBags = items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0);
              const productWeight = items.reduce((s, i) => s + parseFloat(i.weight || 0), 0);
              const productAmount = items.reduce((s, i) => s + parseFloat(i.amount || 0), 0);

              return (
                <View key={productName} className="mb-5">
                  <Text className="text-[14px] font-extrabold text-textMain mb-2 bg-[#F1F5F9] px-2 py-1 rounded tracking-widest">
                    {productName.toUpperCase()}
                  </Text>

                  {items.map((item) => (
                    <View key={item.id} className="pl-2 mb-3 border-b border-background pb-2">
                      <View className="flex-row justify-between items-center">
                        <Text className="flex-[2] text-[14px] font-medium text-textSecondary">{item.variety_name_snapshot}</Text>
                        <Text className="flex-1 text-[14px] font-bold text-textMain text-right">{item.quantity}</Text>
                        <Text className="flex-[1.2] text-[14px] font-bold text-textMain text-right">{Number(item.weight).toFixed(2)} kg</Text>
                        <Text className="flex-[1.5] text-[14px] font-extrabold text-emerald-600 text-right">
                          ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                        </Text>
                      </View>
                      {item.rate > 0 && (
                        <Text className="text-[11px] text-textSecondary ml-0 mt-0.5 pl-0">
                          Rate: ₹{item.rate}/kg
                        </Text>
                      )}
                    </View>
                  ))}

                  {/* Product subtotal */}
                  <View className="flex-row justify-between items-center py-1 pl-2 border-t border-border/40">
                    <Text className="flex-[2] text-[13px] font-bold text-textSecondary italic">{productName} Total</Text>
                    <Text className="flex-1 text-[13px] font-bold text-textMain text-right">{productBags}</Text>
                    <Text className="flex-[1.2] text-[13px] font-bold text-textMain text-right">{productWeight.toFixed(2)} kg</Text>
                    <Text className="flex-[1.5] text-[13px] font-extrabold text-emerald-600 text-right">
                      ₹{productAmount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Grand Total */}
          <View className="border-t-[3px] border-textMain pt-5 pb-2">
            <View className="flex-row justify-between items-center py-1">
              <Text className="text-[15px] font-bold text-textSecondary tracking-widest">TOTAL BAGS</Text>
              <Text className="text-[22px] font-extrabold text-textMain">{displayTotalBags}</Text>
            </View>
            <View className="flex-row justify-between items-center py-1 mt-1">
              <Text className="text-[16px] font-bold text-textMain tracking-widest">TOTAL WEIGHT</Text>
              <Text className="text-[26px] font-extrabold text-primary tracking-tight">{displayTotalWeight.toFixed(2)} kg</Text>
            </View>
            <View className="flex-row justify-between items-center py-1 mt-2 border-t-2 border-dashed border-border pt-3">
              <Text className="text-[18px] font-bold text-textMain tracking-widest">GRAND TOTAL</Text>
              <Text className="text-[32px] font-extrabold text-[#059669] tracking-tight">
                ₹{displayTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          <Text className="text-center text-[12px] font-bold text-textSecondary mt-10 tracking-[2px] uppercase">
            Thank you for your business
          </Text>
        </View>

        {/* Mark Paid Button (bottom, only if unpaid) */}
        {!isPaid && (
          <View className="px-1 mb-4">
            <TouchableOpacity
              className={`bg-red-600 py-4 rounded-2xl items-center flex-row justify-center ${isMarkingPaid ? 'opacity-50' : ''}`}
              onPress={handleMarkPaid}
              disabled={isMarkingPaid}
            >
              {isMarkingPaid ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="check-circle" size={20} color="#fff" />
                  <Text className="text-white font-extrabold text-[16px] tracking-widest ml-2">MARK AS PAID</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View className="px-1">
          <Button title="BACK TO PARTIES" onPress={handleGoBack} type="secondary" />
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}

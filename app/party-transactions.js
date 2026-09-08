import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, ScrollView, RefreshControl, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import EmptyState from '../components/common/EmptyState';
import { Feather } from '@expo/vector-icons';
import { transactionApi } from '../api/services/transactionApi';
import { useTransaction } from '../context/TransactionContext';

const TABS = ['DRAFT', 'RATE', 'COMPLETED'];

export default function PartyTransactionsScreen() {
  const { partyId, partyName } = useLocalSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('DRAFT');
  const [outstandingAmount, setOutstandingAmount] = useState(0);
  const [outstandingCount, setOutstandingCount] = useState(0);

  // Detailed Transaction Modal state
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetail, setTxDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const { setTransactionId, setParty, resetTransaction } = useTransaction();

  useEffect(() => {
    if (partyId) {
      loadTransactions();
      loadOutstanding();
    }
  }, [partyId]);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const res = await transactionApi.getTransactions({ partyId, limit: 200 });
      if (res && res.data) {
        setTransactions(res.data);
      }
    } catch (error) {
      console.error('Failed to load party transactions:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadOutstanding = async () => {
    try {
      const res = await transactionApi.getPartyOutstanding(partyId);
      if (res && res.data) {
        setOutstandingAmount(parseFloat(res.data.outstanding_amount) || 0);
        setOutstandingCount(parseInt(res.data.unpaid_count) || 0);
      }
    } catch (e) {
      console.error('Failed to load outstanding:', e);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadTransactions();
    loadOutstanding();
  };

  const openTransactionDetail = async (tx) => {
    setSelectedTx(tx);
    setDetailModalVisible(true);
    setIsLoadingDetail(true);
    try {
      const res = await transactionApi.getTransaction(tx.id);
      if (res && res.data) {
        setTxDetail(res.data);
      }
    } catch (error) {
      console.error('Failed to load transaction detail:', error);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // ----------------------------------------------------------------
  // Tab filtering
  // ----------------------------------------------------------------
  const tabTransactions = transactions.filter(tx => tx.status === activeTab);

  const draftCount = transactions.filter(tx => tx.status === 'DRAFT').length;
  const rateCount = transactions.filter(tx => tx.status === 'RATE').length;
  const completedCount = transactions.filter(tx => tx.status === 'COMPLETED').length;

  const tabCounts = { DRAFT: draftCount, RATE: rateCount, COMPLETED: completedCount };

  // ----------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------
  const handleContinueWeighing = (tx) => {
    setDetailModalVisible(false);
    resetTransaction();
    setTransactionId(tx.id);
    if (partyName) setParty({ id: partyId, name: partyName });
    router.push('/transaction/calculator');
  };

  const handleApplyRates = (tx) => {
    setDetailModalVisible(false);
    router.push({ pathname: '/transaction/rate-entry', params: { transactionId: tx.id } });
  };

  const handleViewBill = (tx) => {
    setDetailModalVisible(false);
    router.push({ pathname: '/transaction/bill-preview', params: { transactionId: tx.id } });
  };

  const handleMarkPaid = async (billId) => {
    Alert.alert(
      'Mark as Paid',
      'Are you sure you want to mark this bill as paid?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              const res = await transactionApi.markBillPaid(billId);
              if (res.success) {
                setDetailModalVisible(false);
                await loadTransactions();
                await loadOutstanding();
                Alert.alert('Done', 'Bill marked as paid successfully.');
              } else {
                throw new Error(res.message);
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Could not mark bill as paid.');
            }
          }
        }
      ]
    );
  };

  const handleStartNewTransaction = () => {
    resetTransaction();
    setParty({ id: partyId, name: partyName });
    router.push('/select-products');
  };

  // ----------------------------------------------------------------
  // Formatting helpers
  // ----------------------------------------------------------------
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  const formatAmount = (amount) =>
    `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  // ----------------------------------------------------------------
  // Transaction card renderer
  // ----------------------------------------------------------------
  const renderTransactionCard = ({ item }) => {
    const weightVal = parseFloat(item.total_weight) || 0;
    const bags = parseInt(item.total_bags, 10) || 0;
    const dateFormatted = formatDate(item.created_at || item.transaction_date);
    const timeFormatted = formatTime(item.created_at || item.transaction_date);

    return (
      <TouchableOpacity
        onPress={() => openTransactionDetail(item)}
        activeOpacity={0.7}
        className="bg-card rounded-2xl p-4 mb-3 border border-border shadow-sm elevation-1"
      >
        {/* Header Row */}
        <View className="flex-row items-center justify-between mb-2.5">
          <View className="flex-row items-center">
            <View className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center mr-2.5 border border-primary/20">
              <Feather name="file-text" size={18} color="#10B981" />
            </View>
            <View>
              <Text className="text-[16px] font-extrabold text-textMain tracking-tight">
                {item.transaction_number || 'TXN-#' + item.id.substring(0, 8)}
              </Text>
              <Text className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                {item.transaction_type || 'PURCHASE'}
              </Text>
            </View>
          </View>

          {/* Status badge */}
          {activeTab === 'DRAFT' && (
            <View className="px-2.5 py-1 rounded-full border flex-row items-center bg-slate-100 border-slate-200">
              <Feather name="edit" size={12} color="#475569" />
              <Text className="text-[11px] font-bold ml-1.5 text-slate-700">DRAFT</Text>
            </View>
          )}
          {activeTab === 'RATE' && (
            <View className="px-2.5 py-1 rounded-full border flex-row items-center bg-amber-50 border-amber-200">
              <Feather name="tag" size={12} color="#B45309" />
              <Text className="text-[11px] font-bold ml-1.5 text-amber-700">RATE PENDING</Text>
            </View>
          )}
          {activeTab === 'COMPLETED' && (
            <View className="px-2.5 py-1 rounded-full border flex-row items-center bg-emerald-50 border-emerald-200">
              <Feather name="check-circle" size={12} color="#059669" />
              <Text className="text-[11px] font-bold ml-1.5 text-emerald-700">COMPLETED</Text>
            </View>
          )}
        </View>

        {/* Date & Time */}
        <View className="flex-row items-center py-2 border-t border-b border-border/50 my-1">
          <Feather name="calendar" size={13} color="#64748B" />
          <Text className="text-[12px] font-medium text-textSecondary ml-1.5">
            {dateFormatted}{timeFormatted ? ` • ${timeFormatted}` : ''}
          </Text>
        </View>

        {/* Summary Numbers */}
        <View className="flex-row items-center justify-between mt-2.5 pt-1">
          <View className="flex-row items-center gap-4">
            <View>
              <Text className="text-[11px] font-medium text-textSecondary uppercase">Bags</Text>
              <Text className="text-[15px] font-bold text-textMain">{bags} Bags</Text>
            </View>
            <View className="h-6 w-[1px] bg-border" />
            <View>
              <Text className="text-[11px] font-medium text-textSecondary uppercase">Total Weight</Text>
              <Text className="text-[15px] font-extrabold text-primary">
                {weightVal.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
              </Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <Text className="text-[12px] font-bold text-primary mr-1">Open</Text>
            <Feather name="chevron-right" size={16} color="#10B981" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      <View className="flex-1">

        {/* Party Header */}
        <View className="bg-card rounded-2xl p-4 mb-4 border border-border shadow-sm">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-11 h-11 bg-emerald-50 rounded-2xl items-center justify-center mr-3 border border-emerald-100">
                <Feather name="user" size={20} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-[20px] font-extrabold text-textMain" numberOfLines={1}>
                  {partyName || 'Party Transactions'}
                </Text>
                <Text className="text-[12px] font-medium text-textSecondary">Transaction History</Text>
              </View>
            </View>
            {/* New Transaction CTA */}
            <TouchableOpacity
              className="flex-row items-center bg-primary px-3 py-2 rounded-xl"
              onPress={handleStartNewTransaction}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text className="text-white font-bold text-[12px] ml-1">New</Text>
            </TouchableOpacity>
          </View>

          {/* Summary Grid */}
          <View className="flex-row bg-background rounded-xl p-3 border border-border justify-around">
            <View className="items-center">
              <Text className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Draft</Text>
              <Text className="text-[16px] font-extrabold text-slate-600 mt-0.5">{draftCount}</Text>
            </View>
            <View className="h-8 w-[1px] bg-border self-center" />
            <View className="items-center">
              <Text className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Rate</Text>
              <Text className="text-[16px] font-extrabold text-amber-600 mt-0.5">{rateCount}</Text>
            </View>
            <View className="h-8 w-[1px] bg-border self-center" />
            <View className="items-center">
              <Text className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">Completed</Text>
              <Text className="text-[16px] font-extrabold text-emerald-600 mt-0.5">{completedCount}</Text>
            </View>
          </View>
        </View>

        {/* Outstanding Amount Banner (only in COMPLETED tab) */}
        {activeTab === 'COMPLETED' && outstandingAmount > 0 && (
          <View className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[12px] font-bold text-red-700 uppercase tracking-wider mb-1">Outstanding Amount</Text>
                <Text className="text-[28px] font-extrabold text-red-700 tracking-tight">
                  {formatAmount(outstandingAmount)}
                </Text>
              </View>
              <View className="items-end">
                <View className="w-14 h-14 rounded-full bg-red-100 border-2 border-red-200 items-center justify-center">
                  <Feather name="alert-circle" size={28} color="#DC2626" />
                </View>
                <Text className="text-[11px] font-bold text-red-500 mt-1">{outstandingCount} unpaid</Text>
              </View>
            </View>
          </View>
        )}

        {/* DRAFT / RATE / COMPLETED Tabs */}
        <View className="flex-row bg-card p-1 rounded-xl border border-border mb-4">
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-lg items-center ${activeTab === tab ? 'bg-primary' : 'bg-transparent'}`}
            >
              <Text className={`text-[12px] font-extrabold ${activeTab === tab ? 'text-white' : 'text-textSecondary'}`}>
                {tab}
              </Text>
              <Text className={`text-[11px] font-bold ${activeTab === tab ? 'text-[#D1FAE5]' : 'text-textSecondary/60'}`}>
                ({tabCounts[tab]})
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Transaction List */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#10B981" />
            <Text className="text-textSecondary text-[13px] mt-2 font-medium">Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={tabTransactions}
            keyExtractor={(item) => item.id}
            renderItem={renderTransactionCard}
            contentContainerClassName="pb-10"
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#10B981']} />}
            ListEmptyComponent={
              <EmptyState
                icon={activeTab === 'DRAFT' ? 'edit' : activeTab === 'RATE' ? 'tag' : 'check-circle'}
                title={`No ${activeTab} transactions`}
                description={
                  activeTab === 'DRAFT'
                    ? 'No transactions currently being weighed.'
                    : activeTab === 'RATE'
                    ? 'No transactions waiting for rates.'
                    : 'No completed transactions yet.'
                }
              />
            }
          />
        )}

        {/* Transaction Detail Modal */}
        <Modal
          visible={detailModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setDetailModalVisible(false)}
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-card rounded-t-3xl p-6 border-t border-border max-h-[85%] shadow-2xl">
              {/* Modal Header */}
              <View className="flex-row justify-between items-center pb-3 border-b border-border">
                <View className="flex-1 mr-2">
                  <Text className="text-[18px] font-extrabold text-textMain">
                    {txDetail?.transaction?.transaction_number || selectedTx?.transaction_number || 'Transaction Details'}
                  </Text>
                  <Text className="text-[12px] font-medium text-textSecondary">
                    {partyName} • {formatDate(txDetail?.transaction?.created_at || selectedTx?.created_at)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDetailModalVisible(false)}
                  className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
                >
                  <Feather name="x" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {isLoadingDetail ? (
                <View className="py-12 items-center justify-center">
                  <ActivityIndicator size="large" color="#10B981" />
                  <Text className="text-textSecondary text-[13px] mt-2 font-medium">Loading details...</Text>
                </View>
              ) : txDetail ? (
                <ScrollView showsVerticalScrollIndicator={false} className="mt-3">

                  {/* Status + Totals */}
                  <View className="bg-background rounded-2xl p-4 border border-border mb-4">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-[12px] text-textSecondary font-medium">Status</Text>
                      <View className={`px-2 py-0.5 rounded-full border ${
                        txDetail.transaction?.status === 'DRAFT' ? 'bg-slate-100 border-slate-200' :
                        txDetail.transaction?.status === 'RATE' ? 'bg-amber-50 border-amber-200' :
                        'bg-emerald-50 border-emerald-200'
                      }`}>
                        <Text className={`text-[11px] font-bold ${
                          txDetail.transaction?.status === 'DRAFT' ? 'text-slate-700' :
                          txDetail.transaction?.status === 'RATE' ? 'text-amber-700' :
                          'text-emerald-700'
                        }`}>{txDetail.transaction?.status}</Text>
                      </View>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-[12px] text-textSecondary font-medium">Date</Text>
                      <Text className="text-[12px] font-bold text-textMain">
                        {formatDate(txDetail.transaction?.created_at)} • {formatTime(txDetail.transaction?.created_at)}
                      </Text>
                    </View>
                    <View className="pt-2 border-t border-border/60 flex-row justify-between">
                      <Text className="text-[13px] font-bold text-textMain">Total</Text>
                      <Text className="text-[13px] font-extrabold text-primary">
                        {txDetail.totals?.totalBags || 0} Bags • {parseFloat(txDetail.totals?.totalWeight || 0).toFixed(2)} kg
                      </Text>
                    </View>
                    {txDetail.totals?.totalAmount > 0 && (
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-[13px] font-bold text-textMain">Amount</Text>
                        <Text className="text-[15px] font-extrabold text-emerald-600">
                          {formatAmount(txDetail.totals.totalAmount)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Products & Variety Weights */}
                  <Text className="text-[13px] font-bold text-textSecondary uppercase tracking-wider mb-2">
                    Product & Variety Weights
                  </Text>

                  {txDetail.products && txDetail.products.length > 0 ? (
                    txDetail.products.map((prod, pIdx) => (
                      <View key={prod.id || pIdx} className="bg-background rounded-2xl p-4 mb-3 border border-border">
                        <View className="flex-row items-center justify-between mb-2 pb-2 border-b border-border">
                          <View className="flex-row items-center">
                            <Feather name="box" size={15} color="#10B981" />
                            <Text className="text-[15px] font-bold text-textMain ml-1.5">{prod.name}</Text>
                          </View>
                          <Text className="text-[13px] font-bold text-textSecondary">
                            {prod.totalBags} Bags • {parseFloat(prod.totalWeight).toFixed(1)} kg
                          </Text>
                        </View>

                        {prod.varieties && prod.varieties.map((v, vIdx) => (
                          <View key={v.id || vIdx} className="mt-2 bg-card rounded-xl p-3 border border-border/70">
                            <View className="flex-row justify-between items-center mb-2">
                              <Text className="text-[14px] font-bold text-textMain">{v.name}</Text>
                              <Text className="text-[12px] font-extrabold text-primary">
                                {v.totalBags} Bags • {parseFloat(v.totalWeight).toFixed(2)} kg
                              </Text>
                            </View>
                            <View className="flex-row flex-wrap gap-1.5">
                              {v.weights && v.weights.map((w, wIdx) => (
                                <View key={w.id || wIdx} className="bg-background px-2.5 py-1 rounded-lg border border-border">
                                  <Text className="text-[12px] font-bold text-textMain">{parseFloat(w.weight).toFixed(1)} kg</Text>
                                </View>
                              ))}
                            </View>
                            {v.rate !== null && v.rate !== undefined && (
                              <View className="flex-row justify-between mt-2 pt-2 border-t border-border">
                                <Text className="text-[12px] font-bold text-textSecondary">Rate: ₹{v.rate}/kg</Text>
                                <Text className="text-[13px] font-extrabold text-emerald-600">
                                  {formatAmount(v.amount || 0)}
                                </Text>
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    ))
                  ) : (
                    <Text className="text-[13px] text-textSecondary italic p-4 text-center">
                      No products attached yet.
                    </Text>
                  )}

                  {/* Action Buttons */}
                  <View className="mt-5 mb-6 gap-3">
                    {txDetail.transaction?.status === 'DRAFT' && (
                      <TouchableOpacity
                        onPress={() => handleContinueWeighing(txDetail.transaction)}
                        className="bg-primary py-3.5 rounded-xl items-center flex-row justify-center shadow-sm"
                      >
                        <Feather name="play" size={16} color="#FFFFFF" />
                        <Text className="text-[14px] font-bold text-white ml-2">CONTINUE WEIGHING</Text>
                      </TouchableOpacity>
                    )}

                    {txDetail.transaction?.status === 'RATE' && (
                      <TouchableOpacity
                        onPress={() => handleApplyRates(txDetail.transaction)}
                        className="bg-amber-500 py-3.5 rounded-xl items-center flex-row justify-center shadow-sm"
                      >
                        <Feather name="tag" size={16} color="#FFFFFF" />
                        <Text className="text-[14px] font-bold text-white ml-2">APPLY RATES</Text>
                      </TouchableOpacity>
                    )}

                    {txDetail.transaction?.status === 'COMPLETED' && (
                      <>
                        <TouchableOpacity
                          onPress={() => handleViewBill(txDetail.transaction)}
                          className="bg-primary py-3.5 rounded-xl items-center flex-row justify-center shadow-sm"
                        >
                          <Feather name="file-text" size={16} color="#FFFFFF" />
                          <Text className="text-[14px] font-bold text-white ml-2">VIEW BILL</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>

      </View>
    </ScreenContainer>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, RefreshControl, Alert, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import { Feather } from '@expo/vector-icons';
import { transactionApi } from '../api/services/transactionApi';
import { partyApi } from '../api/services/partyApi';
import { useTransaction } from '../context/TransactionContext';

const TABS = ['DRAFT', 'RATE', 'COMPLETED', 'TIMELINE'];

const QUICK_DATE_RANGES = [
  { key: 'ALL', label: 'All Time' },
  { key: 'THIS_MONTH', label: 'This Month' },
  { key: 'LAST_30_DAYS', label: 'Last 30 Days' },
  { key: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { key: 'TODAY', label: 'Today' },
  { key: 'CUSTOM', label: 'Custom' },
];

export default function PartyTransactionsScreen() {
  const { partyId, partyName } = useLocalSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('COMPLETED'); // DRAFT | RATE | COMPLETED | TIMELINE
  const [outstandingAmount, setOutstandingAmount] = useState(0);
  const [outstandingCount, setOutstandingCount] = useState(0);

  // Detailed Transaction Modal state
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetail, setTxDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  // ----------------------------------------------------------------
  // TIMELINE STATE
  // ----------------------------------------------------------------
  const [timelineData, setTimelineData] = useState([]);
  const [timelineSummary, setTimelineSummary] = useState(null);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [selectedQuickRange, setSelectedQuickRange] = useState('ALL');
  const [timelineFrom, setTimelineFrom] = useState('');
  const [timelineTo, setTimelineTo] = useState('');
  const [timelineTypeFilter, setTimelineTypeFilter] = useState('ALL'); // ALL | FAST | REGULAR
  const [timelineStatusFilter, setTimelineStatusFilter] = useState('ALL'); // ALL | PAID | UNPAID

  // Custom Date Range Modal
  const [isDateRangeModalVisible, setIsDateRangeModalVisible] = useState(false);
  const [customFromInput, setCustomFromInput] = useState('');
  const [customToInput, setCustomToInput] = useState('');
  const [dateRangeError, setDateRangeError] = useState('');

  const { setTransactionId, setParty, resetTransaction } = useTransaction();

  useEffect(() => {
    if (partyId) {
      loadTransactions();
      loadOutstanding();
    }
  }, [partyId]);

  useEffect(() => {
    if (partyId && activeTab === 'TIMELINE') {
      loadTimeline();
    }
  }, [partyId, activeTab, timelineFrom, timelineTo, timelineTypeFilter, timelineStatusFilter]);

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

  const loadTimeline = async () => {
    try {
      setIsLoadingTimeline(true);
      const params = {};
      if (timelineFrom) params.from = timelineFrom;
      if (timelineTo) params.to = timelineTo;
      if (timelineTypeFilter !== 'ALL') params.type = timelineTypeFilter;
      if (timelineStatusFilter !== 'ALL') params.paymentStatus = timelineStatusFilter;

      const res = await partyApi.getPartyTimeline(partyId, params);
      if (res && res.success && res.data) {
        setTimelineData(res.data.timeline || []);
        setTimelineSummary(res.data.summary || null);
      }
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setIsLoadingTimeline(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (activeTab === 'TIMELINE') {
      loadTimeline();
      loadOutstanding();
    } else {
      loadTransactions();
      loadOutstanding();
    }
  };

  const openTransactionDetail = async (tx) => {
    const txId = tx.transactionId || tx.id;
    setSelectedTx(tx);
    setDetailModalVisible(true);
    setIsLoadingDetail(true);
    try {
      const res = await transactionApi.getTransaction(txId);
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

  const tabCounts = { DRAFT: draftCount, RATE: rateCount, COMPLETED: completedCount, TIMELINE: '★' };

  // ----------------------------------------------------------------
  // Quick Date Range Shortcuts
  // ----------------------------------------------------------------
  const handleSelectQuickRange = (rangeKey) => {
    setSelectedQuickRange(rangeKey);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (rangeKey === 'ALL') {
      setTimelineFrom('');
      setTimelineTo('');
    } else if (rangeKey === 'TODAY') {
      setTimelineFrom(todayStr);
      setTimelineTo(todayStr);
    } else if (rangeKey === 'LAST_7_DAYS') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setTimelineFrom(d.toISOString().split('T')[0]);
      setTimelineTo(todayStr);
    } else if (rangeKey === 'LAST_30_DAYS') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setTimelineFrom(d.toISOString().split('T')[0]);
      setTimelineTo(todayStr);
    } else if (rangeKey === 'THIS_MONTH') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      setTimelineFrom(d.toISOString().split('T')[0]);
      setTimelineTo(todayStr);
    } else if (rangeKey === 'CUSTOM') {
      setCustomFromInput(timelineFrom || todayStr);
      setCustomToInput(timelineTo || todayStr);
      setDateRangeError('');
      setIsDateRangeModalVisible(true);
    }
  };

  const handleApplyCustomDateRange = () => {
    const fromTrimmed = customFromInput.trim();
    const toTrimmed = customToInput.trim();

    if (fromTrimmed && !/^\d{4}-\d{2}-\d{2}$/.test(fromTrimmed)) {
      setDateRangeError('From date must be in YYYY-MM-DD format');
      return;
    }
    if (toTrimmed && !/^\d{4}-\d{2}-\d{2}$/.test(toTrimmed)) {
      setDateRangeError('To date must be in YYYY-MM-DD format');
      return;
    }

    setTimelineFrom(fromTrimmed);
    setTimelineTo(toTrimmed);
    setSelectedQuickRange('CUSTOM');
    setIsDateRangeModalVisible(false);
  };

  // ----------------------------------------------------------------
  // Actions
  // ----------------------------------------------------------------
  const handleContinueWeighing = (tx) => {
    if (tx.status === 'COMPLETED' || tx.status === 'CONFIRMED' || tx.status === 'CLOSED') {
      Alert.alert('Transaction Completed', 'This transaction is already completed and finalized. Weighing cannot be resumed.');
      handleViewBill(tx);
      return;
    }
    setDetailModalVisible(false);
    resetTransaction();
    setTransactionId(tx.id || tx.transactionId);
    if (partyName) setParty({ id: partyId, name: partyName });
    if (tx.entry_mode === 'FAST') {
      router.push('/transaction/fast-calculator');
    } else {
      router.push('/transaction/calculator');
    }
  };

  const handleApplyRates = (tx) => {
    setDetailModalVisible(false);
    router.push({ pathname: '/transaction/rate-entry', params: { transactionId: tx.id || tx.transactionId } });
  };

  const handleViewBill = (tx) => {
    setDetailModalVisible(false);
    const billId = tx.bill_id || tx.billId;
    const txId = tx.id || tx.transactionId;
    if (billId) {
      router.push({ pathname: '/transaction/bill-preview', params: { billId } });
    } else {
      router.push({ pathname: '/transaction/bill-preview', params: { transactionId: txId } });
    }
  };

  const handleMarkPaid = async (billId) => {
    if (!billId) return;
    Alert.alert(
      'Mark as Paid',
      'Are you sure you want to mark this date-wise bill as paid?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              setIsMarkingPaid(true);
              const res = await transactionApi.markBillPaid(billId);
              if (res.success) {
                setDetailModalVisible(false);
                await loadTransactions();
                await loadOutstanding();
                if (activeTab === 'TIMELINE') await loadTimeline();
                Alert.alert('Paid', 'Bill marked as paid. Outstanding amount updated.');
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
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const [y, m, d] = parts.map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
      }
    }
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
    `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  // ----------------------------------------------------------------
  // Transaction card renderer (for DRAFT, RATE, COMPLETED tabs)
  // ----------------------------------------------------------------
  const renderTransactionCard = ({ item }) => {
    const weightVal = parseFloat(item.total_weight) || 0;
    const bags = parseInt(item.total_bags, 10) || 0;
    const billDate = item.bill_date || item.transaction_date || item.created_at;
    const dateFormatted = formatDate(billDate);
    const timeFormatted = formatTime(item.created_at);
    const isPaid = item.bill_payment_status === 'PAID';
    const isFast = item.entry_mode === 'FAST';

    return (
      <TouchableOpacity
        onPress={() => openTransactionDetail(item)}
        activeOpacity={0.7}
        className="bg-card rounded-2xl p-4 mb-3 border border-border shadow-sm elevation-1"
      >
        {/* Header Row */}
        <View className="flex-row items-center justify-between mb-2.5">
          <View className="flex-row items-center flex-1 mr-2">
            <View className={`w-9 h-9 rounded-xl items-center justify-center mr-2.5 border ${isFast ? 'bg-emerald-100 border-emerald-300' : 'bg-primary/10 border-primary/20'}`}>
              <Feather name={isFast ? "zap" : "file-text"} size={18} color={isFast ? "#059669" : "#10B981"} />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-[16px] font-extrabold text-textMain tracking-tight">
                  {item.bill_number ? `Bill #${item.bill_number}` : (item.transaction_number || 'TXN-#' + item.id.substring(0, 8))}
                </Text>
                {isFast && (
                  <View className="ml-1.5 px-1.5 py-0.5 bg-emerald-100 rounded border border-emerald-200">
                    <Text className="text-[9px] font-extrabold text-emerald-800">FAST</Text>
                  </View>
                )}
              </View>
              <Text className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider">
                {item.transaction_number && item.bill_number ? `TXN: ${item.transaction_number}` : (item.transaction_type || 'PURCHASE')}
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
            <View className={`px-2.5 py-1 rounded-full border flex-row items-center ${isPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <Feather name={isPaid ? "check-circle" : "clock"} size={12} color={isPaid ? "#059669" : "#DC2626"} />
              <Text className={`text-[11px] font-extrabold ml-1.5 ${isPaid ? 'text-emerald-700' : 'text-red-700'}`}>
                {isPaid ? 'PAID' : 'UNPAID'}
              </Text>
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
              <Text className="text-[11px] font-medium text-textSecondary uppercase">Weight</Text>
              <Text className="text-[15px] font-extrabold text-primary">
                {weightVal.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg
              </Text>
            </View>
            <View className="h-6 w-[1px] bg-border" />
            <View>
              <Text className="text-[11px] font-medium text-textSecondary uppercase">Bags / Items</Text>
              <Text className="text-[15px] font-bold text-textMain">{bags}</Text>
            </View>
            {item.bill_amount && (
              <>
                <View className="h-6 w-[1px] bg-border" />
                <View>
                  <Text className="text-[11px] font-medium text-textSecondary uppercase">Amount</Text>
                  <Text className="text-[15px] font-extrabold text-emerald-700">
                    {formatAmount(item.bill_amount)}
                  </Text>
                </View>
              </>
            )}
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
                <Text className="text-[12px] font-medium text-textSecondary">Complete Transaction History</Text>
              </View>
            </View>
            {/* New Transaction CTA */}
            <TouchableOpacity
              className="flex-row items-center bg-primary px-3.5 py-2 rounded-xl"
              onPress={handleStartNewTransaction}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text className="text-white font-bold text-[13px] ml-1">New</Text>
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
        {activeTab === 'COMPLETED' && (
          <View className={`border-2 rounded-2xl p-4 mb-4 ${outstandingAmount > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className={`text-[12px] font-bold uppercase tracking-wider mb-1 ${outstandingAmount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {outstandingAmount > 0 ? 'Outstanding Amount (Unpaid Bills)' : 'All Bills Settled'}
                </Text>
                <Text className={`text-[28px] font-extrabold tracking-tight ${outstandingAmount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {formatAmount(outstandingAmount)}
                </Text>
              </View>
              <View className="items-end">
                <View className={`w-12 h-12 rounded-full border-2 items-center justify-center ${outstandingAmount > 0 ? 'bg-red-100 border-red-200' : 'bg-emerald-100 border-emerald-200'}`}>
                  <Feather name={outstandingAmount > 0 ? "alert-circle" : "check-circle"} size={24} color={outstandingAmount > 0 ? "#DC2626" : "#059669"} />
                </View>
                {outstandingAmount > 0 ? (
                  <Text className="text-[11px] font-bold text-red-500 mt-1">{outstandingCount} unpaid bill(s)</Text>
                ) : (
                  <Text className="text-[11px] font-bold text-emerald-600 mt-1">₹0 outstanding</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* TABS: DRAFT / RATE / COMPLETED / TIMELINE */}
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
              {tab !== 'TIMELINE' ? (
                <Text className={`text-[10px] font-bold ${activeTab === tab ? 'text-[#D1FAE5]' : 'text-textSecondary/60'}`}>
                  ({tabCounts[tab]})
                </Text>
              ) : (
                <Text className={`text-[10px] font-bold ${activeTab === tab ? 'text-[#D1FAE5]' : 'text-textSecondary/60'}`}>
                  History
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ==================================================== */}
        {/* TIMELINE VIEW */}
        {/* ==================================================== */}
        {activeTab === 'TIMELINE' ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="flex-1"
            contentContainerClassName="pb-10"
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#10B981']} />}
          >
            {/* Open Full Table Statement Page Button */}
            <TouchableOpacity
              onPress={() => router.push(`/party-timeline?partyId=${partyId}&partyName=${encodeURIComponent(partyName)}`)}
              className="bg-indigo-600 p-3.5 rounded-2xl mb-4 flex-row items-center justify-between shadow-sm"
              activeOpacity={0.8}
            >
              <View className="flex-row items-center gap-2.5 flex-1">
                <View className="w-8 h-8 rounded-xl bg-white/20 items-center justify-center">
                  <Feather name="grid" size={16} color="#FFFFFF" />
                </View>
                <View className="flex-1">
                  <Text className="text-[13px] font-black text-white">
                    Open Full History Statement Table
                  </Text>
                  <Text className="text-[11px] text-white/80">
                    Dedicated bill format with Date, Variety, Bags, Weight, Rate & Total
                  </Text>
                </View>
              </View>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Quick Date Range Selector */}
            <View className="mb-3">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {QUICK_DATE_RANGES.map(r => {
                  const isSelected = selectedQuickRange === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      onPress={() => handleSelectQuickRange(r.key)}
                      className={`mr-2 px-3.5 py-2 rounded-xl border-2 ${isSelected ? 'bg-primary border-primary' : 'bg-card border-border'}`}
                    >
                      <Text className={`text-[12px] font-extrabold ${isSelected ? 'text-white' : 'text-textSecondary'}`}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Active Range & Custom Filter Trigger */}
            <View className="bg-card rounded-2xl p-3.5 mb-3 border border-border flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 mr-2">
                <Feather name="calendar" size={15} color="#10B981" />
                <Text className="text-[12px] font-extrabold text-textMain ml-2">
                  {timelineFrom && timelineTo
                    ? `${formatDate(timelineFrom)} → ${formatDate(timelineTo)}`
                    : timelineFrom
                    ? `From ${formatDate(timelineFrom)}`
                    : timelineTo
                    ? `Until ${formatDate(timelineTo)}`
                    : 'All Historical Records'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setCustomFromInput(timelineFrom);
                  setCustomToInput(timelineTo);
                  setDateRangeError('');
                  setIsDateRangeModalVisible(true);
                }}
                className="bg-background px-3 py-1.5 rounded-xl border border-border flex-row items-center"
              >
                <Feather name="sliders" size={12} color="#64748B" />
                <Text className="text-[11px] font-bold text-textSecondary ml-1">Change</Text>
              </TouchableOpacity>
            </View>

            {/* Type & Payment Filters */}
            <View className="flex-row gap-2 mb-4">
              {/* Type Filter */}
              <View className="flex-1 flex-row bg-card p-1 rounded-xl border border-border">
                {['ALL', 'FAST', 'REGULAR'].map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setTimelineTypeFilter(t)}
                    className={`flex-1 py-1.5 rounded-lg items-center ${timelineTypeFilter === t ? 'bg-primary' : 'bg-transparent'}`}
                  >
                    <Text className={`text-[10px] font-extrabold ${timelineTypeFilter === t ? 'text-white' : 'text-textSecondary'}`}>
                      {t === 'ALL' ? 'All' : t === 'FAST' ? '⚡Fast' : 'Regular'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Status Filter */}
              <View className="flex-1 flex-row bg-card p-1 rounded-xl border border-border">
                {['ALL', 'PAID', 'UNPAID'].map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setTimelineStatusFilter(s)}
                    className={`flex-1 py-1.5 rounded-lg items-center ${timelineStatusFilter === s ? 'bg-primary' : 'bg-transparent'}`}
                  >
                    <Text className={`text-[10px] font-extrabold ${timelineStatusFilter === s ? 'text-white' : 'text-textSecondary'}`}>
                      {s === 'ALL' ? 'All' : s === 'PAID' ? '✓Paid' : 'Unpaid'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* PERIOD FINANCIAL SUMMARY CARDS */}
            {timelineSummary && (
              <View className="mb-5 bg-card rounded-3xl p-5 border-2 border-emerald-300 shadow-md elevation-2">
                <Text className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-widest mb-3">
                  PERIOD FINANCIAL SUMMARY
                </Text>

                <View className="grid grid-cols-2 gap-3 mb-3">
                  {/* Total Bill Value */}
                  <View className="bg-background p-3.5 rounded-2xl border border-border">
                    <Text className="text-[11px] font-bold text-textSecondary uppercase tracking-wider">Total Bill Value</Text>
                    <Text className="text-[20px] font-extrabold text-textMain mt-1">
                      {formatAmount(timelineSummary.totalBillValue)}
                    </Text>
                  </View>

                  {/* Amount Invested / Spent */}
                  <View className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
                    <Text className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Amount Invested / Spent</Text>
                    <Text className="text-[20px] font-extrabold text-emerald-700 mt-1">
                      {formatAmount(timelineSummary.amountInvestedOrSpent)}
                    </Text>
                  </View>
                </View>

                <View className="grid grid-cols-3 gap-2 pt-2 border-t border-border/80">
                  {/* Unpaid Amount */}
                  <View className="bg-background p-2.5 rounded-xl border border-border items-center">
                    <Text className="text-[10px] font-bold text-red-600 uppercase">Unpaid Total</Text>
                    <Text className="text-[14px] font-extrabold text-red-700 mt-0.5">
                      {formatAmount(timelineSummary.totalUnpaid)}
                    </Text>
                  </View>

                  {/* Total Weight */}
                  <View className="bg-background p-2.5 rounded-xl border border-border items-center">
                    <Text className="text-[10px] font-bold text-textSecondary uppercase">Total Weight</Text>
                    <Text className="text-[14px] font-extrabold text-primary mt-0.5">
                      {Number(timelineSummary.totalWeight).toFixed(1)} kg
                    </Text>
                  </View>

                  {/* Transactions Count */}
                  <View className="bg-background p-2.5 rounded-xl border border-border items-center">
                    <Text className="text-[10px] font-bold text-textSecondary uppercase">Transactions</Text>
                    <Text className="text-[14px] font-extrabold text-textMain mt-0.5">
                      {timelineSummary.totalTransactions}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* TIMELINE FEED */}
            {isLoadingTimeline ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="large" color="#10B981" />
                <Text className="text-textSecondary text-[13px] mt-2 font-medium">Loading timeline history...</Text>
              </View>
            ) : timelineData.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="No transactions found for this period"
                description="Try selecting a wider date range or clearing filters."
                actionTitle="Reset Date Range"
                onAction={() => handleSelectQuickRange('ALL')}
              />
            ) : (
              timelineData.map((dateGroup, dIdx) => (
                <View key={dateGroup.date || dIdx} className="mb-6">
                  
                  {/* Date Header */}
                  <View className="flex-row justify-between items-center bg-slate-100 px-4 py-2.5 rounded-2xl mb-3 border border-slate-200">
                    <View className="flex-row items-center">
                      <Feather name="calendar" size={15} color="#059669" />
                      <Text className="text-[15px] font-extrabold text-textMain ml-2">
                        {formatDate(dateGroup.date)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-[14px] font-extrabold text-emerald-800">
                        Day Total: {formatAmount(dateGroup.dayTotalAmount)}
                      </Text>
                      <Text className="text-[11px] font-bold text-textSecondary">
                        {parseFloat(dateGroup.dayTotalWeight).toFixed(1)} kg
                      </Text>
                    </View>
                  </View>

                  {/* Transactions under this date */}
                  {dateGroup.transactions.map((tx, tIdx) => {
                    const isFast = tx.entryMode === 'FAST';
                    const isPaid = tx.paymentStatus === 'PAID';

                    return (
                      <TouchableOpacity
                        key={tx.transactionId || tIdx}
                        onPress={() => openTransactionDetail(tx)}
                        activeOpacity={0.7}
                        className="bg-card rounded-3xl p-4 mb-3 border-2 border-border shadow-sm elevation-1"
                      >
                        {/* Transaction Card Header */}
                        <View className="flex-row justify-between items-center mb-2.5 pb-2.5 border-b border-border">
                          <View className="flex-row items-center flex-1 mr-2">
                            <View className={`w-8 h-8 rounded-xl items-center justify-center mr-2 border ${isFast ? 'bg-emerald-100 border-emerald-300' : 'bg-blue-50 border-blue-200'}`}>
                              <Feather name={isFast ? "zap" : "layers"} size={16} color={isFast ? "#059669" : "#2563EB"} />
                            </View>
                            <View>
                              <View className="flex-row items-center">
                                <Text className="text-[15px] font-extrabold text-textMain">
                                  {tx.billNumber ? `Bill #${tx.billNumber}` : (tx.transactionNumber || 'Transaction')}
                                </Text>
                                <View className={`ml-2 px-1.5 py-0.2 rounded border ${isFast ? 'bg-emerald-100 border-emerald-300' : 'bg-blue-100 border-blue-200'}`}>
                                  <Text className={`text-[9px] font-extrabold ${isFast ? 'text-emerald-800' : 'text-blue-700'}`}>
                                    {isFast ? 'FAST' : 'REGULAR'}
                                  </Text>
                                </View>
                              </View>
                              {tx.transactionNumber && tx.billNumber && (
                                <Text className="text-[10px] text-textSecondary">TXN: {tx.transactionNumber}</Text>
                              )}
                            </View>
                          </View>

                          {/* Payment Status Badge */}
                          <View className={`px-2.5 py-1 rounded-full border flex-row items-center ${isPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <Feather name={isPaid ? "check-circle" : "clock"} size={11} color={isPaid ? "#059669" : "#DC2626"} />
                            <Text className={`text-[10px] font-extrabold ml-1 ${isPaid ? 'text-emerald-700' : 'text-red-700'}`}>
                              {isPaid ? 'PAID' : 'UNPAID'}
                            </Text>
                          </View>
                        </View>

                        {/* Items Section */}
                        <View className="mb-2">
                          {tx.items && tx.items.map((item, iIdx) => (
                            <View
                              key={iIdx}
                              className="py-1.5 flex-row justify-between items-center border-b border-border/40 last:border-b-0"
                            >
                              <View className="flex-1 mr-2">
                                <Text className="text-[14px] font-bold text-textMain">{item.varietyName}</Text>
                                <Text className="text-[11px] text-textSecondary">{item.productName}</Text>
                              </View>
                              <View className="items-end">
                                <Text className="text-[13px] font-extrabold text-emerald-700">
                                  {formatAmount(item.amount)}
                                </Text>
                                <Text className="text-[11px] font-medium text-textSecondary">
                                  {parseFloat(item.weight).toFixed(1)} kg × ₹{item.rate}/kg
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>

                        {/* Card Subtotal Footer */}
                        <View className="flex-row justify-between items-center pt-2 border-t border-border/80">
                          <Text className="text-[12px] font-bold text-textSecondary">
                            Total: {parseFloat(tx.totalWeight).toFixed(1)} kg
                          </Text>
                          <View className="flex-row items-center">
                            <Text className="text-[14px] font-extrabold text-textMain mr-1">
                              {formatAmount(tx.totalAmount)}
                            </Text>
                            <Feather name="chevron-right" size={15} color="#10B981" />
                          </View>
                        </View>

                      </TouchableOpacity>
                    );
                  })}

                </View>
              ))
            )}

            {/* PERIOD TOTAL FOOTER */}
            {timelineSummary && timelineData.length > 0 && (
              <View className="bg-slate-100 rounded-3xl p-5 border border-slate-300 mt-2">
                <Text className="text-[11px] font-extrabold text-slate-700 uppercase tracking-widest mb-2 text-center">
                  PERIOD TOTAL SUMMARY
                </Text>
                <View className="flex-row justify-between py-1">
                  <Text className="text-[13px] font-bold text-textSecondary">Total Weight:</Text>
                  <Text className="text-[13px] font-extrabold text-primary">{Number(timelineSummary.totalWeight).toFixed(1)} kg</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-[13px] font-bold text-textSecondary">Total Bill Value:</Text>
                  <Text className="text-[13px] font-extrabold text-textMain">{formatAmount(timelineSummary.totalBillValue)}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-[13px] font-bold text-emerald-700">Total Paid:</Text>
                  <Text className="text-[13px] font-extrabold text-emerald-700">{formatAmount(timelineSummary.totalPaid)}</Text>
                </View>
                <View className="flex-row justify-between py-1">
                  <Text className="text-[13px] font-bold text-red-600">Outstanding / Unpaid:</Text>
                  <Text className="text-[13px] font-extrabold text-red-700">{formatAmount(timelineSummary.totalUnpaid)}</Text>
                </View>
              </View>
            )}

          </ScrollView>
        ) : (
          /* REGULAR TRANSACTION LIST (DRAFT, RATE, COMPLETED tabs) */
          isLoading ? (
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
                      : 'No completed transactions or bills yet.'
                  }
                />
              }
            />
          )
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
                  <View className="flex-row items-center">
                    <Text className="text-[18px] font-extrabold text-textMain">
                      {txDetail?.transaction?.bill_number ? `Bill #${txDetail.transaction.bill_number}` : (txDetail?.transaction?.transaction_number || selectedTx?.transaction_number || 'Transaction Details')}
                    </Text>
                    {txDetail?.transaction?.entry_mode === 'FAST' && (
                      <View className="ml-2 px-2 py-0.5 bg-emerald-100 rounded border border-emerald-300">
                        <Text className="text-[10px] font-extrabold text-emerald-800">⚡ FAST</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-[12px] font-medium text-textSecondary">
                    {partyName} • {formatDate(txDetail?.transaction?.bill_date || txDetail?.transaction?.transaction_date || txDetail?.transaction?.created_at || selectedTx?.created_at)}
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

                    {txDetail.transaction?.bill_payment_status && (
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-[12px] text-textSecondary font-medium">Payment Status</Text>
                        <View className={`px-2 py-0.5 rounded-full border ${
                          txDetail.transaction?.bill_payment_status === 'PAID' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                        }`}>
                          <Text className={`text-[11px] font-extrabold ${
                            txDetail.transaction?.bill_payment_status === 'PAID' ? 'text-emerald-700' : 'text-red-700'
                          }`}>{txDetail.transaction?.bill_payment_status}</Text>
                        </View>
                      </View>
                    )}

                    <View className="flex-row justify-between mb-2">
                      <Text className="text-[12px] text-textSecondary font-medium">Date</Text>
                      <Text className="text-[12px] font-bold text-textMain">
                        {formatDate(txDetail.transaction?.bill_date || txDetail.transaction?.transaction_date || txDetail.transaction?.created_at)}
                      </Text>
                    </View>
                    <View className="pt-2 border-t border-border/60 flex-row justify-between">
                      <Text className="text-[13px] font-bold text-textMain">Total Weight</Text>
                      <Text className="text-[13px] font-extrabold text-primary">
                        {parseFloat(txDetail.totals?.totalWeight || 0).toFixed(2)} kg ({txDetail.totals?.totalBags || 0} Bags)
                      </Text>
                    </View>
                    {txDetail.totals?.totalAmount > 0 && (
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-[13px] font-bold text-textMain">Bill Amount</Text>
                        <Text className="text-[16px] font-extrabold text-emerald-600">
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
                                {parseFloat(v.totalWeight).toFixed(2)} kg
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
                      No items attached.
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
                          <Text className="text-[14px] font-bold text-white ml-2">VIEW FULL BILL</Text>
                        </TouchableOpacity>

                        {txDetail.transaction?.bill_id && txDetail.transaction?.bill_payment_status !== 'PAID' && (
                          <TouchableOpacity
                            onPress={() => handleMarkPaid(txDetail.transaction.bill_id)}
                            disabled={isMarkingPaid}
                            className={`bg-red-600 py-3.5 rounded-xl items-center flex-row justify-center shadow-sm ${isMarkingPaid ? 'opacity-50' : ''}`}
                          >
                            {isMarkingPaid ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <>
                                <Feather name="check-circle" size={16} color="#FFFFFF" />
                                <Text className="text-[14px] font-bold text-white ml-2">MARK BILL AS PAID</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Custom Date Range Modal */}
        <Modal
          visible={isDateRangeModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsDateRangeModalVisible(false)}
        >
          <KeyboardAvoidingView
            className="flex-1 justify-end bg-black/60"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View className="bg-card rounded-t-3xl p-6 border-t border-border shadow-2xl">
              <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-border">
                <Text className="text-[18px] font-extrabold text-textMain">Custom Date Range</Text>
                <TouchableOpacity
                  onPress={() => setIsDateRangeModalVisible(false)}
                  className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
                >
                  <Feather name="x" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text className="text-[13px] font-medium text-textSecondary mb-4">
                Filter transactions based on business / bill date (YYYY-MM-DD):
              </Text>

              <View className="mb-3">
                <Text className="text-[12px] font-bold text-textSecondary uppercase tracking-wider mb-1.5">From Date</Text>
                <View className="bg-background border-2 border-border rounded-2xl px-4 py-3">
                  <TextInput
                    className="text-[17px] font-extrabold text-textMain"
                    value={customFromInput}
                    onChangeText={setCustomFromInput}
                    placeholder="2026-07-01"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <View className="mb-3">
                <Text className="text-[12px] font-bold text-textSecondary uppercase tracking-wider mb-1.5">To Date</Text>
                <View className="bg-background border-2 border-border rounded-2xl px-4 py-3">
                  <TextInput
                    className="text-[17px] font-extrabold text-textMain"
                    value={customToInput}
                    onChangeText={setCustomToInput}
                    placeholder="2026-07-31"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {dateRangeError ? (
                <Text className="text-[12px] font-bold text-red-600 mb-3">{dateRangeError}</Text>
              ) : null}

              <View className="flex-row gap-3 mt-4 mb-4">
                <View className="flex-1">
                  <Button
                    title="CANCEL"
                    type="secondary"
                    onPress={() => setIsDateRangeModalVisible(false)}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    title="APPLY FILTER"
                    onPress={handleApplyCustomDateRange}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

      </View>
    </ScreenContainer>
  );
}

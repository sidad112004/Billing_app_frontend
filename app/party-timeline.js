import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import ScreenContainer from '../components/common/ScreenContainer';
import InputField from '../components/common/InputField';
import EmptyState from '../components/common/EmptyState';
import { partyApi } from '../api/services/partyApi';
import { transactionApi } from '../api/services/transactionApi';

export default function PartyTimelineScreen() {
  const params = useLocalSearchParams();
  const partyId = params.partyId;
  const partyName = params.partyName || 'Party';

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timelineData, setTimelineData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [partyInfo, setPartyInfo] = useState(null);

  // Filters
  const [activeDatePreset, setActiveDatePreset] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // ALL, FAST, REGULAR
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PAID, UNPAID

  // Custom Date Picker Modal
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [tempFrom, setTempFrom] = useState('');
  const [tempTo, setTempTo] = useState('');

  // Transaction Detail Modal
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetail, setTxDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  useEffect(() => {
    if (partyId) {
      loadTimeline();
    }
  }, [partyId, dateFrom, dateTo, typeFilter, statusFilter]);

  const loadTimeline = async () => {
    try {
      setIsLoading(true);
      const queryParams = {};
      if (dateFrom) queryParams.from = dateFrom;
      if (dateTo) queryParams.to = dateTo;
      if (typeFilter !== 'ALL') queryParams.type = typeFilter;
      if (statusFilter !== 'ALL') queryParams.paymentStatus = statusFilter;

      const res = await partyApi.getPartyTimeline(partyId, queryParams);
      if (res && res.success && res.data) {
        setTimelineData(res.data.timeline || []);
        setSummary(res.data.summary || null);
        if (res.data.party) {
          setPartyInfo(res.data.party);
        }
      }
    } catch (error) {
      console.error('Failed to load party timeline:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadTimeline();
  };

  // Helper date formatting YYYY-MM-DD
  const formatDateStr = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const applyPreset = (preset) => {
    setActiveDatePreset(preset);
    const today = new Date();

    if (preset === 'ALL') {
      setDateFrom('');
      setDateTo('');
      return;
    }

    if (preset === 'TODAY') {
      const formatted = formatDateStr(today);
      setDateFrom(formatted);
      setDateTo(formatted);
      return;
    }

    if (preset === 'THIS_WEEK') {
      const currentDay = today.getDay(); // 0 is Sunday
      const diffToMonday = (currentDay === 0 ? -6 : 1) - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMonday);
      setDateFrom(formatDateStr(monday));
      setDateTo(formatDateStr(today));
      return;
    }

    if (preset === 'THIS_MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(formatDateStr(firstDay));
      setDateTo(formatDateStr(today));
      return;
    }

    if (preset === 'LAST_7_DAYS') {
      const past = new Date(today);
      past.setDate(today.getDate() - 7);
      setDateFrom(formatDateStr(past));
      setDateTo(formatDateStr(today));
      return;
    }

    if (preset === 'LAST_30_DAYS') {
      const past = new Date(today);
      past.setDate(today.getDate() - 30);
      setDateFrom(formatDateStr(past));
      setDateTo(formatDateStr(today));
      return;
    }

    if (preset === 'CUSTOM') {
      setTempFrom(dateFrom || formatDateStr(today));
      setTempTo(dateTo || formatDateStr(today));
      setIsDatePickerVisible(true);
    }
  };

  const handleApplyCustomDates = () => {
    setDateFrom(tempFrom);
    setDateTo(tempTo);
    setActiveDatePreset('CUSTOM');
    setIsDatePickerVisible(false);
  };

  const handleResetFilters = () => {
    setActiveDatePreset('ALL');
    setDateFrom('');
    setDateTo('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
  };

  const openTransactionDetail = async (tx) => {
    const txId = tx.transactionId || tx.id;
    setSelectedTx(tx);
    setIsDetailModalVisible(true);
    setIsDetailLoading(true);
    try {
      const res = await transactionApi.getTransaction(txId);
      if (res && res.data) {
        setTxDetail(res.data);
      }
    } catch (error) {
      console.error('Failed to load transaction detail:', error);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleViewFullBill = (tx) => {
    setIsDetailModalVisible(false);
    const txId = tx?.transactionId || tx?.id;
    const billId = tx?.billId || tx?.bill_id;
    if (billId) {
      router.push({ pathname: '/transaction/bill-preview', params: { billId } });
    } else if (txId) {
      router.push({ pathname: '/transaction/bill-preview', params: { transactionId: txId } });
    }
  };

  // Flatten rows for table rendering
  // Column structure requested:
  // 1: Date | 2: Variety | 3: Bags | 4: Weight (kg) | 5: Rate (₹) | 6: Total (₹)
  const tableRows = [];
  let calculatedTotalBags = 0;
  let calculatedTotalWeight = 0;
  let calculatedTotalAmount = 0;

  timelineData.forEach((group) => {
    const groupDate = group.date;
    (group.transactions || []).forEach((tx) => {
      const items = tx.items || [];
      const isFast = tx.entryMode === 'FAST';

      if (items.length === 0) {
        // Fallback row if no items
        const bags = tx.totalBags || 1;
        const weight = tx.totalWeight || 0;
        const rate = weight > 0 ? (tx.totalAmount / weight) : 0;
        const total = tx.totalAmount || 0;

        calculatedTotalBags += bags;
        calculatedTotalWeight += weight;
        calculatedTotalAmount += total;

        tableRows.push({
          rowKey: `${tx.transactionId}-single`,
          date: groupDate,
          productName: 'General',
          varietyName: tx.entryMode || 'Transaction',
          bags,
          weight: Math.round(weight * 100) / 100,
          rate: Math.round(rate * 100) / 100,
          total: Math.round(total * 100) / 100,
          entryMode: tx.entryMode,
          paymentStatus: tx.paymentStatus,
          billNumber: tx.billNumber || tx.transactionNumber,
          txRaw: tx,
        });
      } else {
        items.forEach((item, itemIdx) => {
          const bags = isFast ? 1 : (item.bagCount || 1);
          const weight = item.weight || 0;
          const rate = item.rate || 0;
          const total = item.amount || (weight * rate);

          calculatedTotalBags += bags;
          calculatedTotalWeight += weight;
          calculatedTotalAmount += total;

          tableRows.push({
            rowKey: `${tx.transactionId}-${itemIdx}`,
            date: groupDate,
            productName: item.productName || '',
            varietyName: item.varietyName || 'Variety',
            bags,
            weight: Math.round(weight * 100) / 100,
            rate: Math.round(rate * 100) / 100,
            total: Math.round(total * 100) / 100,
            entryMode: tx.entryMode,
            paymentStatus: tx.paymentStatus,
            billNumber: tx.billNumber || tx.transactionNumber,
            txRaw: tx,
            isFirstInTx: itemIdx === 0,
            itemCountInTx: items.length,
          });
        });
      }
    });
  });

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={['#10B981']} />
        }
      >
        {/* Header Title Card */}
        <View className="bg-card p-4 rounded-2xl border border-border shadow-sm mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-primary/15 items-center justify-center">
                  <Feather name="clock" size={16} color="#10B981" />
                </View>
                <Text className="text-[18px] font-extrabold text-textMain">{partyName}</Text>
              </View>
              <Text className="text-[12px] text-textSecondary mt-1 ml-10">
                Complete Billing & Transaction History Statement
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.back()}
              className="px-3 py-1.5 rounded-xl bg-background border border-border flex-row items-center"
            >
              <Feather name="arrow-left" size={14} color="#64748B" />
              <Text className="text-[12px] font-bold text-textSecondary ml-1">Back</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Filter Shortcuts Bar */}
        <View className="mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
            {[
              { key: 'ALL', label: 'All Time' },
              { key: 'TODAY', label: 'Today' },
              { key: 'THIS_WEEK', label: 'This Week' },
              { key: 'THIS_MONTH', label: 'This Month' },
              { key: 'LAST_7_DAYS', label: 'Last 7 Days' },
              { key: 'LAST_30_DAYS', label: 'Last 30 Days' },
              { key: 'CUSTOM', label: 'Custom Range' },
            ].map((p) => {
              const isSelected = activeDatePreset === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => applyPreset(p.key)}
                  className={`px-3.5 py-1.5 rounded-full border ${
                    isSelected
                      ? 'bg-primary border-primary'
                      : 'bg-card border-border'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-[12px] font-bold ${
                      isSelected ? 'text-white' : 'text-textSecondary'
                    }`}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Active Range & Reset Indicator */}
        {(dateFrom || dateTo || typeFilter !== 'ALL' || statusFilter !== 'ALL') ? (
          <View className="flex-row items-center justify-between bg-primary/10 px-3.5 py-2 rounded-xl border border-primary/20 mb-3">
            <View className="flex-row items-center gap-1.5 flex-1 flex-wrap">
              <Feather name="calendar" size={13} color="#10B981" />
              <Text className="text-[12px] font-bold text-primary">
                {dateFrom || 'Start'} → {dateTo || 'End'}
              </Text>
              {typeFilter !== 'ALL' ? (
                <Text className="text-[11px] bg-card px-2 py-0.5 rounded border border-border font-bold text-textMain">
                  Mode: {typeFilter}
                </Text>
              ) : null}
              {statusFilter !== 'ALL' ? (
                <Text className="text-[11px] bg-card px-2 py-0.5 rounded border border-border font-bold text-textMain">
                  Status: {statusFilter}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={handleResetFilters} className="ml-2">
              <Text className="text-[12px] font-bold text-red-500">Reset</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Filter Pills: Mode & Payment Status */}
        <View className="flex-row items-center justify-between mb-4 gap-2">
          {/* Mode Selector */}
          <View className="flex-row bg-card p-1 rounded-xl border border-border flex-1">
            {['ALL', 'FAST', 'REGULAR'].map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setTypeFilter(m)}
                className={`flex-1 py-1 items-center rounded-lg ${
                  typeFilter === m ? 'bg-primary' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    typeFilter === m ? 'text-white' : 'text-textSecondary'
                  }`}
                >
                  {m === 'ALL' ? 'All Modes' : m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payment Status Selector */}
          <View className="flex-row bg-card p-1 rounded-xl border border-border flex-1">
            {['ALL', 'PAID', 'UNPAID'].map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatusFilter(s)}
                className={`flex-1 py-1 items-center rounded-lg ${
                  statusFilter === s
                    ? s === 'PAID'
                      ? 'bg-emerald-600'
                      : s === 'UNPAID'
                      ? 'bg-amber-600'
                      : 'bg-primary'
                    : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    statusFilter === s ? 'text-white' : 'text-textSecondary'
                  }`}
                >
                  {s === 'ALL' ? 'All Status' : s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Financial Summary Metric Cards */}
        {summary ? (
          <View className="bg-card p-4 rounded-2xl border border-border shadow-sm mb-4">
            <Text className="text-[13px] font-bold text-textMain mb-3 uppercase tracking-wider">
              Period Financial Summary
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              <View className="flex-1 min-w-[100px] bg-background p-2.5 rounded-xl border border-border">
                <Text className="text-[10px] font-bold text-textSecondary uppercase">Bills / Txns</Text>
                <Text className="text-[16px] font-black text-textMain mt-0.5">
                  {summary.totalTransactions || 0}
                </Text>
              </View>

              <View className="flex-1 min-w-[100px] bg-background p-2.5 rounded-xl border border-border">
                <Text className="text-[10px] font-bold text-textSecondary uppercase">Total Weight</Text>
                <Text className="text-[16px] font-black text-primary mt-0.5">
                  {(summary.totalWeight || 0).toLocaleString()} <Text className="text-[11px] font-medium text-textSecondary">kg</Text>
                </Text>
              </View>

              <View className="flex-1 min-w-[100px] bg-background p-2.5 rounded-xl border border-border">
                <Text className="text-[10px] font-bold text-textSecondary uppercase">Bill Value</Text>
                <Text className="text-[16px] font-black text-textMain mt-0.5">
                  ₹{(summary.totalBillValue || 0).toLocaleString()}
                </Text>
              </View>

              <View className="flex-1 min-w-[100px] bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                <Text className="text-[10px] font-bold text-emerald-700 uppercase">Paid</Text>
                <Text className="text-[16px] font-black text-emerald-700 mt-0.5">
                  ₹{(summary.totalPaid || 0).toLocaleString()}
                </Text>
              </View>

              <View className="flex-1 min-w-[100px] bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                <Text className="text-[10px] font-bold text-amber-700 uppercase">Unpaid</Text>
                <Text className="text-[16px] font-black text-amber-700 mt-0.5">
                  ₹{(summary.totalUnpaid || 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* TABLE STATEMENT FORMAT */}
        {isLoading ? (
          <View className="p-12 items-center justify-center bg-card rounded-2xl border border-border">
            <ActivityIndicator size="large" color="#10B981" />
            <Text className="text-textSecondary text-[13px] font-medium mt-3">Loading history statement...</Text>
          </View>
        ) : tableRows.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="No Transactions in Period"
            description="No transaction records match the selected date range and filter criteria."
          />
        ) : (
          <View className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden mb-4">
            {/* Table Title Bar */}
            <View className="bg-background px-4 py-3 border-b border-border flex-row justify-between items-center">
              <View className="flex-row items-center gap-2">
                <Feather name="grid" size={15} color="#10B981" />
                <Text className="text-[14px] font-black text-textMain">Transaction Bill Statement</Text>
              </View>
              <Text className="text-[11px] font-bold text-textSecondary">
                {tableRows.length} Rows • Scroll table horizontally →
              </Text>
            </View>

            {/* Scrollable Table Area */}
            <ScrollView horizontal showsHorizontalScrollIndicator={true} className="w-full">
              <View className="min-w-[680px]">
                {/* TABLE HEADER */}
                <View className="flex-row bg-slate-100 dark:bg-slate-800 border-b border-border py-2.5 px-3">
                  <Text className="w-[100px] text-[11px] font-black text-textMain uppercase">
                    1. Date
                  </Text>
                  <Text className="w-[180px] text-[11px] font-black text-textMain uppercase">
                    2. Variety
                  </Text>
                  <Text className="w-[60px] text-[11px] font-black text-textMain uppercase text-center">
                    3. Bags
                  </Text>
                  <Text className="w-[90px] text-[11px] font-black text-textMain uppercase text-right">
                    4. Weight (kg)
                  </Text>
                  <Text className="w-[85px] text-[11px] font-black text-textMain uppercase text-right">
                    5. Rate (₹)
                  </Text>
                  <Text className="w-[110px] text-[11px] font-black text-textMain uppercase text-right">
                    6. Total (₹)
                  </Text>
                  <Text className="w-[75px] text-[11px] font-black text-textMain uppercase text-center">
                    Status
                  </Text>
                </View>

                {/* TABLE BODY ROWS */}
                {tableRows.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  const isPaid = row.paymentStatus === 'PAID';

                  return (
                    <TouchableOpacity
                      key={row.rowKey}
                      onPress={() => openTransactionDetail(row.txRaw)}
                      activeOpacity={0.7}
                      className={`flex-row items-center border-b border-border/60 py-2.5 px-3 ${
                        isEven ? 'bg-card' : 'bg-background/50'
                      }`}
                    >
                      {/* 1. Date */}
                      <View className="w-[100px]">
                        <Text className="text-[12px] font-bold text-textMain">{row.date}</Text>
                        <Text className="text-[9px] text-textSecondary" numberOfLines={1}>
                          {row.billNumber}
                        </Text>
                      </View>

                      {/* 2. Variety */}
                      <View className="w-[180px] pr-2">
                        <View className="flex-row items-center gap-1">
                          <Text className="text-[12px] font-bold text-textMain" numberOfLines={1}>
                            {row.varietyName}
                          </Text>
                          <Text
                            className={`text-[8px] font-black px-1 py-0.2 rounded ${
                              row.entryMode === 'FAST'
                                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400'
                                : 'bg-slate-500/15 text-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {row.entryMode || 'REG'}
                          </Text>
                        </View>
                        {row.productName ? (
                          <Text className="text-[10px] text-textSecondary" numberOfLines={1}>
                            {row.productName}
                          </Text>
                        ) : null}
                      </View>

                      {/* 3. Bags */}
                      <View className="w-[60px] items-center">
                        <Text className="text-[12px] font-bold text-textMain">{row.bags}</Text>
                      </View>

                      {/* 4. Weight */}
                      <View className="w-[90px] items-end">
                        <Text className="text-[12px] font-bold text-textMain">
                          {row.weight.toLocaleString()}
                        </Text>
                      </View>

                      {/* 5. Rate */}
                      <View className="w-[85px] items-end">
                        <Text className="text-[12px] font-bold text-textMain">
                          ₹{row.rate}
                        </Text>
                      </View>

                      {/* 6. Total */}
                      <View className="w-[110px] items-end">
                        <Text className="text-[12px] font-black text-primary">
                          ₹{row.total.toLocaleString()}
                        </Text>
                      </View>

                      {/* Status */}
                      <View className="w-[75px] items-center">
                        <View
                          className={`px-1.5 py-0.5 rounded-full ${
                            isPaid ? 'bg-emerald-500/15' : 'bg-amber-500/15'
                          }`}
                        >
                          <Text
                            className={`text-[9px] font-black ${
                              isPaid ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {isPaid ? 'PAID' : 'UNPAID'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* TABLE FOOTER SUMMARY TOTALS ROW */}
                <View className="flex-row bg-slate-200 dark:bg-slate-900 border-t-2 border-border py-3 px-3 items-center">
                  <View className="w-[280px]">
                    <Text className="text-[12px] font-black text-textMain uppercase">
                      Total Statement Summary
                    </Text>
                    <Text className="text-[10px] text-textSecondary">
                      {tableRows.length} total entry rows
                    </Text>
                  </View>

                  {/* Total Bags */}
                  <View className="w-[60px] items-center">
                    <Text className="text-[13px] font-black text-textMain">
                      {calculatedTotalBags}
                    </Text>
                  </View>

                  {/* Total Weight */}
                  <View className="w-[90px] items-end">
                    <Text className="text-[13px] font-black text-primary">
                      {Math.round(calculatedTotalWeight * 100) / 100}
                    </Text>
                    <Text className="text-[9px] text-textSecondary">kg</Text>
                  </View>

                  {/* Empty space under rate */}
                  <View className="w-[85px] items-end">
                    <Text className="text-[11px] font-bold text-textSecondary">—</Text>
                  </View>

                  {/* Total Amount */}
                  <View className="w-[110px] items-end">
                    <Text className="text-[14px] font-black text-emerald-700 dark:text-emerald-400">
                      ₹{(Math.round(calculatedTotalAmount * 100) / 100).toLocaleString()}
                    </Text>
                  </View>

                  <View className="w-[75px]" />
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* CUSTOM DATE PICKER MODAL */}
      <Modal
        visible={isDatePickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDatePickerVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-4">
          <View className="bg-card w-full max-w-sm rounded-3xl p-6 border border-border shadow-2xl">
            <View className="flex-row items-center justify-between pb-3 border-b border-border mb-4">
              <View className="flex-row items-center gap-2">
                <Feather name="calendar" size={18} color="#10B981" />
                <Text className="text-[16px] font-black text-textMain">Custom Date Range</Text>
              </View>
              <TouchableOpacity onPress={() => setIsDatePickerVisible(false)}>
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <InputField
              label="From Date (YYYY-MM-DD)"
              placeholder="e.g. 2026-09-01"
              value={tempFrom}
              onChangeText={setTempFrom}
            />

            <InputField
              label="To Date (YYYY-MM-DD)"
              placeholder="e.g. 2026-09-13"
              value={tempTo}
              onChangeText={setTempTo}
            />

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={() => setIsDatePickerVisible(false)}
                className="flex-1 py-3 rounded-xl bg-background border border-border items-center"
              >
                <Text className="text-[13px] font-bold text-textSecondary">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleApplyCustomDates}
                className="flex-1 py-3 rounded-xl bg-primary items-center"
              >
                <Text className="text-[13px] font-bold text-white">Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TRANSACTION / BILL DETAIL MODAL */}
      <Modal
        visible={isDetailModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-card rounded-t-3xl p-6 border-t border-border max-h-[85%] shadow-2xl">
            <View className="flex-row justify-between items-center pb-3 border-b border-border mb-4">
              <View>
                <Text className="text-[18px] font-black text-textMain">
                  {selectedTx?.billNumber || selectedTx?.transactionNumber || 'Transaction Details'}
                </Text>
                <Text className="text-[12px] text-textSecondary mt-0.5">
                  Date: {selectedTx?.businessDate || selectedTx?.billDate || selectedTx?.date} • Mode: {selectedTx?.entryMode || 'REGULAR'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsDetailModalVisible(false)}
                className="w-8 h-8 rounded-full bg-background items-center justify-center border border-border"
              >
                <Feather name="x" size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            {isDetailLoading ? (
              <View className="p-8 items-center justify-center">
                <ActivityIndicator size="large" color="#10B981" />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Financial Summary */}
                <View className="bg-background p-4 rounded-2xl border border-border mb-4">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-textSecondary text-[13px]">Payment Status</Text>
                    <Text
                      className={`text-[13px] font-black ${
                        selectedTx?.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {selectedTx?.paymentStatus || 'UNPAID'}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-textSecondary text-[13px]">Total Bags</Text>
                    <Text className="text-textMain text-[13px] font-bold">{selectedTx?.totalBags || 1}</Text>
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-textSecondary text-[13px]">Total Weight</Text>
                    <Text className="text-textMain text-[13px] font-bold">{selectedTx?.totalWeight} kg</Text>
                  </View>
                  <View className="flex-row justify-between pt-2 border-t border-border/60">
                    <Text className="text-textMain text-[15px] font-black">Total Bill Amount</Text>
                    <Text className="text-primary text-[16px] font-black">₹{selectedTx?.totalAmount}</Text>
                  </View>
                </View>

                {/* Items Breakdown */}
                <Text className="text-[14px] font-black text-textMain mb-2 uppercase">Items Breakdown</Text>
                {(selectedTx?.items || []).map((it, idx) => (
                  <View key={idx} className="bg-background p-3 rounded-xl border border-border mb-2 flex-row justify-between items-center">
                    <View className="flex-1">
                      <Text className="text-[13px] font-bold text-textMain">{it.varietyName}</Text>
                      {it.productName ? (
                        <Text className="text-[11px] text-textSecondary">{it.productName}</Text>
                      ) : null}
                    </View>
                    <View className="items-end">
                      <Text className="text-[12px] font-bold text-textMain">
                        {it.weight} kg × ₹{it.rate}
                      </Text>
                      <Text className="text-[13px] font-black text-primary">₹{it.amount}</Text>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  onPress={() => handleViewFullBill(selectedTx)}
                  className="bg-primary py-3.5 rounded-xl items-center flex-row justify-center mt-4 mb-3 shadow-sm"
                >
                  <Feather name="file-text" size={16} color="#FFFFFF" />
                  <Text className="text-[14px] font-bold text-white ml-2">VIEW FULL BILL</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

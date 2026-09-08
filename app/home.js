import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { transactionApi } from '../api/services/transactionApi';
import { useTransaction } from '../context/TransactionContext';

export default function Home() {
  const { user, logout } = useAuth();
  const { setTransactionId, setParty } = useTransaction();
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isLoadingTx, setIsLoadingTx] = useState(false);

  useEffect(() => {
    loadRecentTransactions();
  }, []);

  const loadRecentTransactions = async () => {
    try {
      setIsLoadingTx(true);
      const res = await transactionApi.getTransactions({ limit: 5 });
      if (res && res.data) {
        setRecentTransactions(res.data);
      }
    } catch (error) {
      console.error('Failed to load recent transactions:', error);
    } finally {
      setIsLoadingTx(false);
    }
  };

  const handleTxPress = (item) => {
    if (item.status === 'CONFIRMED' || item.status === 'CLOSED') {
      router.push({ pathname: '/transaction/bill-preview', params: { transactionId: item.id } });
    } else {
      setTransactionId(item.id);
      if (item.party_name) {
        setParty({ id: item.party_id, name: item.party_name });
      }
      router.push('/transaction/calculator');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerClassName="flex-grow pb-10" showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View className="flex-row justify-between items-center mb-8 py-4 px-2">
          <View>
            <Text className="text-[14px] font-bold text-primary mb-1 uppercase tracking-widest">{user?.millName || 'Mill Master'}</Text>
            <Text className="text-[28px] font-extrabold text-textMain tracking-tight">Welcome, {user?.name || 'User'}</Text>
          </View>
          <TouchableOpacity 
            className="w-14 h-14 rounded-full bg-card items-center justify-center border-2 border-border shadow-sm elevation-2"
            onPress={logout}
          >
            <Feather name="log-out" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Primary Actions */}
        <View className="mb-8 px-2 gap-3">
          <TouchableOpacity 
            className="bg-primary rounded-3xl p-6 items-center flex-row justify-center shadow-medium elevation-3"
            onPress={() => router.push('/select-party')}
            activeOpacity={0.8}
          >
            <Feather name="plus-circle" size={24} color="#FFFFFF" className="mr-3" />
            <Text className="text-[17px] font-bold text-[#FFFFFF] tracking-wide ml-2">NEW TRANSACTION</Text>
          </TouchableOpacity>

          <View className="flex-row gap-3">
            <TouchableOpacity 
              className="flex-1 bg-card rounded-2xl p-4 items-center flex-row justify-between border border-border shadow-sm elevation-1"
              onPress={() => router.push('/parties')}
              activeOpacity={0.8}
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center mr-2.5 border border-emerald-100">
                  <Feather name="users" size={18} color="#10B981" />
                </View>
                <Text className="text-[15px] font-bold text-textMain">Parties</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-1 bg-card rounded-2xl p-4 items-center flex-row justify-between border border-border shadow-sm elevation-1"
              onPress={() => router.push('/products')}
              activeOpacity={0.8}
            >
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center mr-2.5 border border-emerald-100">
                  <Feather name="box" size={18} color="#10B981" />
                </View>
                <Text className="text-[15px] font-bold text-textMain">Products</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions Section */}
        <View className="flex-1 px-2">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-[14px] font-bold text-textSecondary tracking-[1.5px] uppercase">Recent Transactions</Text>
            <TouchableOpacity onPress={() => router.push('/parties')}>
              <Text className="text-[14px] font-bold text-primary">View by Party</Text>
            </TouchableOpacity>
          </View>

          {isLoadingTx ? (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator size="small" color="#10B981" />
            </View>
          ) : recentTransactions.length > 0 ? (
            recentTransactions.map((item) => {
              const isDone = item.status === 'CONFIRMED' || item.status === 'CLOSED';
              const wt = parseFloat(item.total_weight) || 0;
              const bags = parseInt(item.total_bags, 10) || 0;

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleTxPress(item)}
                  activeOpacity={0.7}
                  className="bg-card rounded-2xl p-4 mb-3 border border-border shadow-sm elevation-1"
                >
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-1 mr-2">
                      <Text className="text-[15px] font-bold text-textMain" numberOfLines={1}>
                        {item.party_name || 'Customer'}
                      </Text>
                      <Text className="text-[12px] font-medium text-textSecondary">
                        {item.transaction_number || 'TXN'} • {formatDate(item.created_at || item.transaction_date)} {formatTime(item.created_at || item.transaction_date)}
                      </Text>
                    </View>
                    <View className={`px-2.5 py-1 rounded-full border ${isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      <Text className={`text-[11px] font-bold ${isDone ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {isDone ? 'Completed' : item.status}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between pt-2 border-t border-border/50 mt-1">
                    <Text className="text-[13px] font-semibold text-textSecondary">
                      {bags} Bags • <Text className="text-primary font-bold">{wt.toFixed(1)} kg</Text>
                    </Text>
                    <View className="flex-row items-center">
                      <Text className="text-[12px] font-bold text-primary mr-1">
                        {isDone ? 'View Bill' : 'Resume'}
                      </Text>
                      <Feather name="chevron-right" size={14} color="#10B981" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <EmptyState 
              icon="inbox" 
              title="No transactions yet" 
              description="Start a new transaction to see it here."
            />
          )}
        </View>

      </ScrollView>
    </ScreenContainer>
  );
}


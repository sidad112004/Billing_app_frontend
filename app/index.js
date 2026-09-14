import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Feather } from '@expo/vector-icons';

export default function Index() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/home');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading]);

  return (
    <View className="flex-1 justify-center items-center bg-background px-6">
      <View className="w-24 h-24 bg-[#ECFDF5] rounded-full items-center justify-center mb-6 shadow-soft border-[4px] border-[#D1FAE5]">
        <Feather name="layers" size={44} color="#10B981" />
      </View>
      <Text className="text-[32px] font-extrabold text-textMain tracking-tight mb-2">Mill Master</Text>
      <Text className="text-[15px] text-textSecondary font-medium text-center mb-8">Weighing & Transaction Management</Text>
      <ActivityIndicator size="large" color="#10B981" />
    </View>
  );
}

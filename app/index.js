import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import Button from '../components/common/Button';

export default function Index() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerClassName="py-12 px-4 flex-grow justify-center">
        <Text className="text-[32px] font-extrabold text-textMain mb-2 text-center tracking-tight">Mill Master</Text>
        <Text className="text-[16px] text-textSecondary mb-12 text-center font-medium">Development Entry Point</Text>
        
        <View className="gap-6 bg-card p-6 rounded-3xl border border-border shadow-sm elevation-1">
          <Button title="Login Screen" onPress={() => router.push('/login')} />
          <Button title="Create Account" onPress={() => router.push('/create-account')} type="secondary" />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

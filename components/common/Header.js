import React from 'react';
import { View, Text } from 'react-native';

export default function Header({ title }) {
  return (
    <View className="px-6 pb-6 pt-12 bg-primary items-center justify-center rounded-b-3xl shadow-sm elevation-4 z-10 relative">
      <Text className="text-[24px] font-extrabold tracking-wide text-card">{title}</Text>
    </View>
  );
}

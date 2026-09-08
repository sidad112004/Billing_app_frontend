import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function EmptyState({ icon = 'inbox', title, description }) {
  return (
    <View className="p-10 items-center justify-center bg-card rounded-3xl border-2 border-border border-dashed my-6 shadow-sm elevation-1">
      <View className="w-20 h-20 rounded-full bg-background items-center justify-center mb-6 border border-border">
        <Feather name={icon} size={36} color="#34D399" />
      </View>
      <Text className="text-[20px] font-bold text-textMain mb-2 text-center">{title}</Text>
      {description && <Text className="text-[14px] text-textSecondary text-center leading-[22px]">{description}</Text>}
    </View>
  );
}

import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScreenContainer({ children }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <View className="flex-1 px-4 pt-4 pb-2">
        {children}
      </View>
    </SafeAreaView>
  );
}

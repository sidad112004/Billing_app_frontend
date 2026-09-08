import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../../components/common/ScreenContainer';

/**
 * This screen has been superseded by the new workflow.
 * The old "Final Review" step is now handled by:
 *   - summary.js (Review Weights + Submit Weights)
 *   - rate-entry.js (Apply Rates + Complete Bill)
 * 
 * Redirect to parties if this old route is ever accessed.
 */
export default function FinalReview() {
  useEffect(() => {
    router.replace('/parties');
  }, []);

  return (
    <ScreenContainer>
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="text-textSecondary mt-3">Redirecting...</Text>
      </View>
    </ScreenContainer>
  );
}

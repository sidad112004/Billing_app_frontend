import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import Button from '../components/common/Button';
import { THEME } from '../constants/theme';

export default function BillPreview() {
  return (
    <ScreenContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Bill Preview Screen</Text>
        <Button 
          title="Back to Home" 
          onPress={() => router.replace('/home')} 
          style={styles.btn} 
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: THEME.typography.sizes.h2,
    color: THEME.colors.textMain,
    marginBottom: THEME.spacing.lg,
  },
  btn: {
    width: '100%',
  }
});

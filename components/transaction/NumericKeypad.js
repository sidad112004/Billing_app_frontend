import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../constants/theme';

const styles = StyleSheet.create({
  keypadBtn: {
    flex: 1,
    aspectRatio: 2,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  keypadNormal: {
    backgroundColor: '#FFFFFF',
  },
  keypadSpecial: {
    backgroundColor: '#F1F5F9',
  },
  btnText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A',
  },
});

const KeypadButton = React.memo(function KeypadButton({ label, onPress, isSpecial = false }) {
  return (
    <TouchableOpacity 
      style={[styles.keypadBtn, isSpecial ? styles.keypadSpecial : styles.keypadNormal]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {label === '⌫' ? (
        <Feather name="delete" size={24} color={THEME.colors.textMain} />
      ) : (
        <Text style={styles.btnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
});

export default function NumericKeypad({ onKeyPress, onBackspace }) {
  return (
    <View className="justify-center mb-4">
      <View className="flex-row justify-between mb-2">
        <KeypadButton label="1" onPress={() => onKeyPress('1')} />
        <KeypadButton label="2" onPress={() => onKeyPress('2')} />
        <KeypadButton label="3" onPress={() => onKeyPress('3')} />
      </View>
      <View className="flex-row justify-between mb-2">
        <KeypadButton label="4" onPress={() => onKeyPress('4')} />
        <KeypadButton label="5" onPress={() => onKeyPress('5')} />
        <KeypadButton label="6" onPress={() => onKeyPress('6')} />
      </View>
      <View className="flex-row justify-between mb-2">
        <KeypadButton label="7" onPress={() => onKeyPress('7')} />
        <KeypadButton label="8" onPress={() => onKeyPress('8')} />
        <KeypadButton label="9" onPress={() => onKeyPress('9')} />
      </View>
      <View className="flex-row justify-between mb-2">
        <KeypadButton label="." onPress={() => onKeyPress('.')} isSpecial />
        <KeypadButton label="0" onPress={() => onKeyPress('0')} />
        <KeypadButton label="⌫" onPress={onBackspace} isSpecial />
      </View>
    </View>
  );
}

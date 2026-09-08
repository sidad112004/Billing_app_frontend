import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../../constants/theme'; // only needed for color prop in Feather

export default function NumericKeypad({ onKeyPress, onBackspace }) {
  const KeypadButton = ({ label, onPress, isSpecial = false }) => (
    <TouchableOpacity 
      className={`flex-1 aspect-[2] mx-1 rounded-md items-center justify-center border border-border shadow-sm elevation-1 ${isSpecial ? 'bg-[#F7FAFC]' : 'bg-card'}`}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {label === '⌫' ? (
        <Feather name="delete" size={24} color={THEME.colors.textMain} />
      ) : (
        <Text className="text-[28px] font-bold text-textMain">{label}</Text>
      )}
    </TouchableOpacity>
  );

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

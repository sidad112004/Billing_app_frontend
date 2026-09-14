import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primary: {
    backgroundColor: '#10B981',
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  disabledPrimary: {
    backgroundColor: '#E2E8F0',
    opacity: 0.6,
  },
  disabledSecondary: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    opacity: 0.6,
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#10B981',
  },
  disabledText: {
    color: '#94A3B8',
  },
});

export default function Button({ title, onPress, type = 'primary', style, disabled }) {
  const isPrimary = type === 'primary';

  const buttonStyle = [
    styles.button,
    isPrimary
      ? (disabled ? styles.disabledPrimary : styles.primary)
      : (disabled ? styles.disabledSecondary : styles.secondary),
    style,
  ];

  const textStyle = [
    styles.text,
    disabled
      ? styles.disabledText
      : (isPrimary ? styles.primaryText : styles.secondaryText),
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={disabled ? null : onPress}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
    >
      <Text style={textStyle}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

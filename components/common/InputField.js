import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

/**
 * InputField — shared text input component.
 *
 * CRITICAL FIX for NativeWind regression:
 * NativeWind remounts a component whenever the className string changes
 * (because it internally adds new CSS variables after initial render).
 * 
 * The className on the border container MUST be 100% static.
 * Dynamic styling (focus / error border color) is done via the `style`
 * prop using React Native StyleSheet — NOT via className.
 *
 * This prevents the "components need to set CSS variable during initial
 * render" warning and stops the focus-jumping / input regression.
 */
const InputField = React.memo(function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  error,
  rightIcon,
  onRightIconPress,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
  autoCapitalize,
  autoCorrect,
  editable,
  multiline,
  numberOfLines,
  inputRef,
  testID,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(error && error.trim());

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  // Dynamic border color via style prop — NEVER via className
  const borderColor = hasError
    ? '#EF4444'   // error (red)
    : isFocused
    ? '#10B981'   // primary (green)
    : '#E2E8F0';  // border (default gray)

  return (
    <View className="mb-6 w-full">
      {label ? (
        <Text className="text-[14px] font-bold text-textSecondary uppercase tracking-[1px] mb-2">
          {label}
        </Text>
      ) : null}

      {/*
        STATIC className — never changes, so NativeWind never remounts.
        Dynamic border color is applied via style prop only.
      */}
      <View
        className="flex-row items-center bg-card rounded-2xl min-h-[60px]"
        style={[styles.inputContainer, { borderColor }]}
      >
        <TextInput
          ref={inputRef}
          className="flex-1 px-5 text-[16px] text-textMain font-medium h-full"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={secureTextEntry}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={autoCorrect ?? false}
          editable={editable !== undefined ? editable : true}
          multiline={multiline}
          numberOfLines={numberOfLines}
          testID={testID}
          blurOnSubmit={false}
        />

        {rightIcon ? (
          <TouchableOpacity
            onPress={onRightIconPress}
            className="p-4 justify-center items-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name={rightIcon} size={20} color={isFocused ? '#10B981' : '#64748B'} />
          </TouchableOpacity>
        ) : null}
      </View>

      {hasError ? (
        <Text className="text-error text-[12px] font-medium mt-1 ml-1">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  inputContainer: {
    borderWidth: 2,
  },
});

export default InputField;

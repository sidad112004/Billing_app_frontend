import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

export default function Button({ title, onPress, type = 'primary', style, disabled }) {
  const isPrimary = type === 'primary';
  
  const baseButtonClass = "py-4 px-8 rounded-2xl items-center justify-center min-h-[56px] shadow-sm elevation-2";
  const primaryButtonClass = disabled ? "bg-border border-border opacity-60 shadow-none elevation-0" : "bg-primary";
  const secondaryButtonClass = disabled ? "bg-border border-border opacity-60 shadow-none elevation-0" : "bg-card border-[1.5px] border-primary";
  
  const baseTextClass = "text-[18px] font-bold tracking-wide";
  const primaryTextClass = disabled ? "text-textSecondary" : "text-card";
  const secondaryTextClass = disabled ? "text-textSecondary" : "text-primary";

  return (
    <TouchableOpacity 
      className={`${baseButtonClass} ${isPrimary ? primaryButtonClass : secondaryButtonClass}`} 
      style={style}
      onPress={disabled ? null : onPress}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
    >
      <Text className={`${baseTextClass} ${isPrimary ? primaryTextClass : secondaryTextClass}`}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import Button from '../components/common/Button';
import InputField from '../components/common/InputField';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTransaction } from '../context/TransactionContext';

export default function Login() {
  const { login, user, isLoading } = useAuth();
  const { resetTransaction } = useTransaction();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // If user session is restored on initial load, redirect to home
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/home');
    }
  }, [isLoading]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password');
      return;
    }
    
    setIsLoggingIn(true);
    setError('');
    
    const result = await login(username.trim(), password, resetTransaction);
    setIsLoggingIn(false);

    if (result.success) {
      router.replace('/home');
    } else {
      setError(result.error || 'Invalid credentials');
    }
  };

  // Stable callbacks — won't cause InputField to remount on re-render
  const handleUsernameChange = useCallback((text) => {
    setUsername(text);
    setError('');
  }, []);

  const handlePasswordChange = useCallback((text) => {
    setPassword(text);
    setError('');
  }, []);

  const handleTogglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerClassName="flex-grow justify-center py-8" showsVerticalScrollIndicator={false}>
          
          <View className="items-center mb-12">
            <View className="w-28 h-28 bg-[#ECFDF5] rounded-full items-center justify-center mb-6 shadow-soft border-[4px] border-[#D1FAE5]">
              <Feather name="layers" size={48} color="#10B981" />
            </View>
            <Text className="text-[36px] font-extrabold text-textMain mb-2 text-center tracking-tight">Mill Master</Text>
            <Text className="text-[16px] text-textSecondary text-center font-medium">Weighing & Transaction Management</Text>
          </View>

          <View className="bg-card p-8 rounded-3xl border border-border shadow-medium elevation-3">
            <InputField
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <InputField
              label="Operator Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-off' : 'eye'}
              onRightIconPress={handleTogglePassword}
              error={error}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <Button 
              title={isLoggingIn ? "LOGGING IN..." : "LOGIN"} 
              onPress={handleLogin} 
              className={`mt-6 w-full ${isLoggingIn ? 'opacity-70' : ''}`} 
              disabled={isLoggingIn}
            />

            <View className="mt-6 flex-row justify-center items-center">
              <Text className="text-[14px] text-textSecondary font-medium">Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/create-account')} activeOpacity={0.7}>
                <Text className="text-[14px] font-bold text-primary ml-1">Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

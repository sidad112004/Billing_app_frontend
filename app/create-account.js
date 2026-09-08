import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import Button from '../components/common/Button';
import InputField from '../components/common/InputField';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { id: 'OWNER', label: 'Owner', desc: 'Full administrative & financial access', icon: 'shield' },
  { id: 'MANAGER', label: 'Manager', desc: 'Operational & party management', icon: 'user-check' },
  { id: 'OPERATOR', label: 'Operator', desc: 'Weighing & entry operations', icon: 'truck' },
];

export default function CreateAccount() {
  const { createAccount } = useAuth();
  
  const [name, setName] = useState('');
  const [millName, setMillName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('OWNER');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Full name is required';
    if (!username.trim()) {
      errs.username = 'Username is required';
    } else if (username.trim().length < 3) {
      errs.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      errs.username = 'Username can only contain letters, numbers, and underscores';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 4) {
      errs.password = 'Password must be at least 4 characters';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateAccount = async () => {
    setGeneralError('');
    setSuccessMessage('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await createAccount({
        name: name.trim(),
        millName: millName.trim() || undefined,
        username: username.trim().toLowerCase(),
        password,
        role,
      });

      setIsSubmitting(false);

      if (result.success) {
        setSuccessMessage('Account created successfully! Redirecting to login...');
        setTimeout(() => {
          router.replace('/login');
        }, 1500);
      } else {
        setGeneralError(result.error || 'Failed to create account. Please try again.');
      }
    } catch (err) {
      setIsSubmitting(false);
      setGeneralError(err.message || 'An unexpected error occurred');
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerClassName="flex-grow justify-center py-8" showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View className="items-center mb-8">
            <View className="w-24 h-24 bg-[#ECFDF5] rounded-full items-center justify-center mb-4 shadow-soft border-[4px] border-[#D1FAE5]">
              <Feather name="user-plus" size={40} color="#10B981" />
            </View>
            <Text className="text-[32px] font-extrabold text-textMain mb-1 text-center tracking-tight">Create Account</Text>
            <Text className="text-[15px] text-textSecondary text-center font-medium">Join Mill Master Weighing & Billing System</Text>
          </View>

          {/* Form Card */}
          <View className="bg-card p-6 rounded-3xl border border-border shadow-medium elevation-3">
            
            {generalError ? (
              <View key="alert-error-banner" className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 flex-row items-center">
                <Feather name="alert-circle" size={20} color="#EF4444" />
                <Text className="text-red-700 text-[14px] font-medium flex-1 ml-2">{generalError}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View key="alert-success-banner" className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex-row items-center">
                <Feather name="check-circle" size={20} color="#10B981" />
                <Text className="text-emerald-800 text-[14px] font-bold flex-1 ml-2">{successMessage}</Text>
              </View>
            ) : null}

            {/* Full Name */}
            <InputField
              label="Full Name *"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              error={errors.name}
            />

            {/* Mill / Business Name */}
            <InputField
              label="Mill / Business Name (Optional)"
              placeholder="e.g. Sri Lakshmi Agro Mill"
              value={millName}
              onChangeText={setMillName}
            />

            {/* Username */}
            <InputField
              label="Username *"
              placeholder="e.g. ramesh_owner"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (errors.username) setErrors({ ...errors, username: '' });
              }}
              error={errors.username}
            />

            {/* Role Selection */}
            <View className="mb-6">
              <Text className="text-[14px] font-bold text-textSecondary uppercase tracking-[1px] mb-3">Account Role *</Text>
              <View className="gap-2.5">
                {ROLES.map((r) => {
                  const isSelected = role === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => setRole(r.id)}
                      activeOpacity={0.8}
                      className={`p-3.5 rounded-2xl border-2 flex-row items-center transition-all ${
                        isSelected 
                          ? 'bg-emerald-50/70 border-primary shadow-sm' 
                          : 'bg-background border-border'
                      }`}
                    >
                      <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                        isSelected ? 'bg-primary' : 'bg-card border border-border'
                      }`}>
                        <Feather name={r.icon} size={18} color={isSelected ? '#FFFFFF' : '#64748B'} />
                      </View>
                      <View className="flex-1">
                        <Text className={`text-[15px] font-bold ${isSelected ? 'text-primary' : 'text-textMain'}`}>
                          {r.label}
                        </Text>
                        <Text className="text-[12px] text-textSecondary">{r.desc}</Text>
                      </View>
                      <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                        isSelected ? 'border-primary bg-primary' : 'border-[#94A3B8]'
                      }`}>
                        {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Password */}
            <InputField
              label="Password *"
              placeholder="Enter secure password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowPassword(!showPassword)}
              error={errors.password}
            />

            {/* Confirm Password */}
            <InputField
              label="Confirm Password *"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
              }}
              secureTextEntry={!showConfirmPassword}
              rightIcon={showConfirmPassword ? 'eye-off' : 'eye'}
              onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
              error={errors.confirmPassword}
            />

            {/* Submit Button */}
            <Button
              title={isSubmitting ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              onPress={handleCreateAccount}
              className={`mt-4 w-full ${isSubmitting ? 'opacity-70' : ''}`}
              disabled={isSubmitting}
            />

            {/* Login Link */}
            <View className="mt-6 flex-row justify-center items-center">
              <Text className="text-[14px] text-textSecondary font-medium">Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7}>
                <Text className="text-[14px] font-bold text-primary ml-1">Log In</Text>
              </TouchableOpacity>
            </View>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

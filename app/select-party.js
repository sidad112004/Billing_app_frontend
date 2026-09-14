import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import { Feather } from '@expo/vector-icons';
import { partyApi } from '../api/services/partyApi';
import { useTransaction } from '../context/TransactionContext';

export default function SelectParty() {
  const [searchQuery, setSearchQuery] = useState('');
  const [parties, setParties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Add Party Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [nameError, setNameError] = useState('');
  const [formError, setFormError] = useState('');

  const { setParty } = useTransaction();

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    try {
      setIsLoading(true);
      const res = await partyApi.getParties({ limit: 100 });
      if (res.success) {
        setParties(res.data);
      }
    } catch (error) {
      console.error('Failed to load parties:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadParties();
  };

  // Filter parties based on search query
  const filteredParties = parties.filter(party => 
    party.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (party.location && party.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSelectParty = (party) => {
    setParty(party);
    router.push('/select-products');
  };

  const handleOpenAddModal = () => {
    setName('');
    setPhone('');
    setLocation('');
    setAddress('');
    setNotes('');
    setNameError('');
    setFormError('');
    setIsModalVisible(true);
  };

  const handleSaveParty = async () => {
    if (!name.trim()) {
      setNameError('Party name is required');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const res = await partyApi.createParty({
        name: name.trim(),
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        setIsModalVisible(false);
        // Automatically select the newly created party and continue transaction
        setParty(res.data);
        router.push('/select-products');
      } else {
        setFormError(res.message || 'Failed to create party');
      }
    } catch (err) {
      setFormError(err.message || 'Network error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const renderPartyItem = ({ item }) => (
    <TouchableOpacity 
      className="bg-card rounded-2xl p-6 mb-4 flex-row items-center justify-between border border-border shadow-sm elevation-1"
      onPress={() => handleSelectParty(item)}
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 bg-background rounded-full items-center justify-center mr-4">
        <Feather name="user" size={20} color="#10B981" />
      </View>
      <View className="flex-1">
        <Text className="text-[18px] font-bold text-textMain mb-1">{item.name}</Text>
        <View className="flex-row items-center">
          <Feather name="map-pin" size={12} color="#64748B" />
          <Text className="text-[14px] text-textSecondary ml-1 font-medium">{item.location || 'No location'}</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={24} color="#CBD5E1" />
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <View className="flex-1">
        
        <View className="mb-2">
          <InputField
            placeholder="Search party..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            rightIcon="search"
          />
        </View>

        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={filteredParties}
            keyExtractor={(item) => item.id}
            renderItem={renderPartyItem}
            contentContainerClassName="pb-8"
            showsVerticalScrollIndicator={false}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <Text className="text-center text-textSecondary mt-8 text-[16px]">No parties found matching "{searchQuery}"</Text>
            }
          />
        )}

        <View className="pt-4 pb-2">
          <Button 
            title="ADD NEW PARTY" 
            type="secondary"
            onPress={handleOpenAddModal} 
          />
        </View>

        {/* Add Party Modal */}
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <KeyboardAvoidingView
            className="flex-1 justify-end bg-black/50"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View className="bg-card rounded-t-3xl p-6 border-t border-border max-h-[90%] shadow-lg">
              <View className="flex-row justify-between items-center mb-5 pb-3 border-b border-border">
                <Text className="text-[20px] font-extrabold text-textMain">Add New Party</Text>
                <TouchableOpacity
                  onPress={() => setIsModalVisible(false)}
                  className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
                >
                  <Feather name="x" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {formError ? (
                  <View key="party-add-error" className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex-row items-center">
                    <Feather name="alert-circle" size={18} color="#EF4444" />
                    <Text className="text-red-700 text-[13px] font-medium ml-2 flex-1">{formError}</Text>
                  </View>
                ) : null}

                <InputField
                  label="Party Name *"
                  placeholder="e.g. Sri Balaji Traders"
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (nameError) setNameError('');
                  }}
                  error={nameError}
                />

                <InputField
                  label="Phone Number"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChangeText={setPhone}
                />

                <InputField
                  label="Location / City"
                  placeholder="e.g. Raichur Market"
                  value={location}
                  onChangeText={setLocation}
                />

                <InputField
                  label="Address"
                  placeholder="e.g. Main Road, APMC"
                  value={address}
                  onChangeText={setAddress}
                />

                <InputField
                  label="Notes"
                  placeholder="e.g. Direct wholesale dealer"
                  value={notes}
                  onChangeText={setNotes}
                />

                <View className="mt-4 mb-6 flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      title="CANCEL"
                      type="secondary"
                      onPress={() => setIsModalVisible(false)}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      title={isSaving ? "SAVING..." : "SAVE & SELECT"}
                      onPress={handleSaveParty}
                      disabled={isSaving}
                    />
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        
      </View>
    </ScreenContainer>
  );
}

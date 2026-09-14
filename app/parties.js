import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import ScreenContainer from '../components/common/ScreenContainer';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { Feather } from '@expo/vector-icons';
import { partyApi } from '../api/services/partyApi';
import { useTransaction } from '../context/TransactionContext';

export default function PartiesScreen() {
  const [parties, setParties] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [nameError, setNameError] = useState('');

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

  const openAddModal = () => {
    setEditingParty(null);
    setName('');
    setPhone('');
    setLocation('');
    setAddress('');
    setNotes('');
    setFormError('');
    setNameError('');
    setIsModalVisible(true);
  };

  const openEditModal = (party) => {
    setEditingParty(party);
    setName(party.name || '');
    setPhone(party.phone || '');
    setLocation(party.location || '');
    setAddress(party.address || '');
    setNotes(party.notes || '');
    setFormError('');
    setNameError('');
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
      const payload = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (editingParty) {
        const res = await partyApi.updateParty(editingParty.id, payload);
        if (res.success) {
          setIsModalVisible(false);
          loadParties();
        } else {
          setFormError(res.message || 'Failed to update party');
        }
      } else {
        const res = await partyApi.createParty(payload);
        if (res.success) {
          setIsModalVisible(false);
          loadParties();
        } else {
          setFormError(res.message || 'Failed to create party');
        }
      }
    } catch (err) {
      setFormError(err.message || 'Network error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartTransaction = (party) => {
    setParty(party);
    router.push('/select-products');
  };

  const filteredParties = parties.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.phone && p.phone.includes(searchQuery))
  );

  const handleViewTransactions = (party) => {
    router.push({
      pathname: '/party-transactions',
      params: { partyId: party.id, partyName: party.name },
    });
  };

  const renderPartyItem = ({ item }) => (
    <View className="bg-card rounded-2xl p-5 mb-4 border border-border shadow-sm elevation-1">
      <TouchableOpacity
        onPress={() => handleViewTransactions(item)}
        activeOpacity={0.7}
        className="flex-row items-start justify-between"
      >
        <View className="flex-row items-center flex-1 mr-3">
          <View className="w-12 h-12 bg-emerald-50 rounded-2xl items-center justify-center mr-3 border border-emerald-100">
            <Feather name="user" size={22} color="#10B981" />
          </View>
          <View className="flex-1">
            <Text className="text-[17px] font-bold text-textMain">{item.name}</Text>
            {item.location ? (
              <View className="flex-row items-center mt-1">
                <Feather name="map-pin" size={12} color="#64748B" />
                <Text className="text-[13px] text-textSecondary ml-1">{item.location}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            className="p-2 rounded-xl bg-background border border-border"
          >
            <Feather name="edit-2" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {item.phone || item.address ? (
        <TouchableOpacity
          onPress={() => handleViewTransactions(item)}
          activeOpacity={0.7}
          className="mt-3 pt-3 border-t border-border/60 flex-row flex-wrap gap-y-1"
        >
          {item.phone ? (
            <View className="flex-row items-center mr-4">
              <Feather name="phone" size={12} color="#64748B" />
              <Text className="text-[13px] text-textSecondary ml-1">{item.phone}</Text>
            </View>
          ) : null}
          {item.address ? (
            <View className="flex-row items-center">
              <Feather name="home" size={12} color="#64748B" />
              <Text className="text-[13px] text-textSecondary ml-1 flex-1" numberOfLines={1}>{item.address}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : null}

      <View className="mt-4 pt-3 border-t border-border/60 flex-row justify-between items-center gap-2">
        <TouchableOpacity
          onPress={() => handleViewTransactions(item)}
          className="bg-background px-3 py-2 rounded-xl flex-row items-center border border-border flex-1 justify-center"
          activeOpacity={0.7}
        >
          <Feather name="file-text" size={13} color="#64748B" />
          <Text className="text-[12px] font-bold text-textMain ml-1">Transactions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push(`/party-timeline?partyId=${item.id}&partyName=${encodeURIComponent(item.name)}`)}
          className="bg-indigo-500/10 px-3 py-2 rounded-xl flex-row items-center border border-indigo-500/20 flex-1 justify-center"
          activeOpacity={0.7}
        >
          <Feather name="clock" size={13} color="#6366F1" />
          <Text className="text-[12px] font-bold text-indigo-700 dark:text-indigo-400 ml-1">Statement</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleStartTransaction(item)}
          className="bg-primary/10 px-3 py-2 rounded-xl flex-row items-center border border-primary/30 flex-1 justify-center"
          activeOpacity={0.7}
        >
          <Feather name="plus-circle" size={13} color="#10B981" />
          <Text className="text-[12px] font-bold text-primary ml-1">New Bill</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <View className="flex-1">
        
        {/* Top Search & Add Bar */}
        <View className="flex-row items-center gap-3 mb-4">
          <View className="flex-1">
            <InputField
              placeholder="Search by name, location, phone..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              rightIcon="search"
            />
          </View>
        </View>

        {/* List */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : (
          <FlatList
            data={filteredParties}
            keyExtractor={(item) => item.id}
            renderItem={renderPartyItem}
            contentContainerClassName="pb-24"
            showsVerticalScrollIndicator={false}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <EmptyState
                icon="users"
                title="No parties found"
                description={searchQuery ? `No results for "${searchQuery}"` : "Click 'Add New Party' to add your first customer or supplier."}
              />
            }
          />
        )}

        {/* Floating Add Button */}
        <View className="absolute bottom-6 left-0 right-0 px-2">
          <Button
            title="+ ADD NEW PARTY"
            onPress={openAddModal}
          />
        </View>

        {/* Add/Edit Modal */}
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
                <Text className="text-[20px] font-extrabold text-textMain">
                  {editingParty ? 'Edit Party' : 'Add New Party'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsModalVisible(false)}
                  className="w-9 h-9 rounded-full bg-background items-center justify-center border border-border"
                >
                  <Feather name="x" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {formError ? (
                  <View key="party-form-error" className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 flex-row items-center">
                    <Feather name="alert-circle" size={18} color="#EF4444" />
                    <Text className="text-red-700 text-[13px] font-medium ml-2 flex-1">{formError}</Text>
                  </View>
                ) : null}

                <InputField
                  label="Party Name *"
                  placeholder="e.g. Dhanlobhe Traders"
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
                  placeholder="e.g. Hubli Market Yard"
                  value={location}
                  onChangeText={setLocation}
                />

                <InputField
                  label="Address"
                  placeholder="e.g. Shop No. 12, APMC Yard"
                  value={address}
                  onChangeText={setAddress}
                />

                <InputField
                  label="Notes / Description"
                  placeholder="e.g. Regular wholesale buyer"
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
                      title={isSaving ? "SAVING..." : (editingParty ? "UPDATE" : "SAVE PARTY")}
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

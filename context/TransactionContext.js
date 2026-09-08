import React, { createContext, useState, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { transactionApi } from '../api/services/transactionApi';

const TransactionContext = createContext();

const INITIAL_STATE = {
  party: null,
  backendTransactionId: null,
  backendVarietyMap: null,
  selectedProducts: [],
  selectedVarieties: [],
  weightEntries: [],
  pendingSync: [],
  // NOTE: rates are no longer stored in local context.
  // They are stored server-side on transaction_varieties.rate and loaded from the backend.
};

export function TransactionProvider({ children }) {
  const [transactionState, setTransactionState] = useState({ ...INITIAL_STATE });

  // Use a ref so async functions always read the latest state (fixes closure stale-state bug)
  const stateRef = useRef(transactionState);
  const updateState = (updater) => {
    setTransactionState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      stateRef.current = next;
      return next;
    });
  };

  const setBackendTransactionId = (id) => {
    updateState(prev => ({ ...prev, backendTransactionId: id }));
  };

  // Allow setting transactionId by either name (for compatibility)
  const setTransactionId = (id) => {
    updateState(prev => ({ ...prev, backendTransactionId: id }));
  };

  const setParty = (party) => {
    updateState(prev => ({ ...prev, party }));
  };

  const initializeBackendTransaction = async () => {
    // Always read from ref to get freshest state (avoids stale closure)
    const currentState = stateRef.current;
    if (currentState.backendTransactionId) return true;

    if (!currentState.party) {
      console.error('No party selected, cannot initialize transaction');
      return false;
    }

    try {
      // 1. Create Transaction on backend
      const txRes = await transactionApi.createTransaction({
        partyId: currentState.party.id,
        transactionType: 'PURCHASE'
      });

      if (!txRes.success) throw new Error(txRes.message || 'Failed to create transaction');
      const txId = txRes.data.id;

      // Keep a mapping of local varietyId -> backend transactionVarietyId
      const varietyMap = {};

      // Group varieties by product
      const productMap = {};
      currentState.selectedVarieties.forEach(v => {
        if (!productMap[v.productId]) productMap[v.productId] = [];
        productMap[v.productId].push(v);
      });

      for (const productId of Object.keys(productMap)) {
        // 2. Add product to transaction
        const tpRes = await transactionApi.addTransactionProduct(txId, { productId });
        if (!tpRes.success) throw new Error(tpRes.message || 'Failed to add product');

        const txProdId = tpRes.data.id;

        for (const variety of productMap[productId]) {
          // 3. Add variety to transaction product
          const tvRes = await transactionApi.addTransactionVariety(txProdId, { varietyId: variety.id });
          if (!tvRes.success) throw new Error(tvRes.message || 'Failed to add variety');

          varietyMap[variety.id] = tvRes.data.id;
        }
      }

      updateState(prev => ({
        ...prev,
        backendTransactionId: txId,
        backendVarietyMap: varietyMap
      }));
      return true;

    } catch (error) {
      console.error('Transaction initialization error:', error);
      return false;
    }
  };

  /**
   * Add a product+varieties to an already-initialized backend transaction.
   * Used when the operator discovers a new product while weighing.
   */
  const addProductVarietiesToTransaction = async (newVarieties) => {
    const currentState = stateRef.current;
    if (!currentState.backendTransactionId || !currentState.backendVarietyMap) {
      console.error('Transaction not initialized');
      return false;
    }

    try {
      const txId = currentState.backendTransactionId;
      const varietyMap = { ...currentState.backendVarietyMap };

      // Group new varieties by product
      const productMap = {};
      newVarieties.forEach(v => {
        if (!productMap[v.productId]) productMap[v.productId] = [];
        productMap[v.productId].push(v);
      });

      for (const productId of Object.keys(productMap)) {
        // Try to add product (may already exist — backend will handle unique constraint)
        let txProdId;
        try {
          const tpRes = await transactionApi.addTransactionProduct(txId, { productId });
          if (tpRes.success) {
            txProdId = tpRes.data.id;
          } else {
            // Product may already be in transaction, fetch its ID from existing data
            // We'll try adding varieties anyway with what we have
            console.warn('Product may already exist in transaction:', tpRes.message);
            continue;
          }
        } catch (e) {
          console.warn('Failed to add product to transaction:', e);
          continue;
        }

        for (const variety of productMap[productId]) {
          try {
            const tvRes = await transactionApi.addTransactionVariety(txProdId, { varietyId: variety.id });
            if (tvRes.success) {
              varietyMap[variety.id] = tvRes.data.id;
            }
          } catch (e) {
            console.warn('Failed to add variety to transaction:', e);
          }
        }
      }

      // Update context state with new varieties and updated map
      updateState(prev => ({
        ...prev,
        selectedVarieties: [...prev.selectedVarieties, ...newVarieties],
        selectedProducts: (() => {
          const existing = prev.selectedProducts.map(p => p.id);
          const toAdd = newVarieties
            .filter(v => !existing.includes(v.productId))
            .map(v => ({ id: v.productId, name: v.productName }));
          return [...prev.selectedProducts, ...toAdd];
        })(),
        backendVarietyMap: varietyMap
      }));

      return true;
    } catch (error) {
      console.error('Error adding product/varieties to transaction:', error);
      return false;
    }
  };

  const toggleProduct = (product) => {
    updateState((prev) => {
      const isSelected = prev.selectedProducts.some((p) => p.id === product.id);
      let updatedProducts;
      let updatedVarieties = prev.selectedVarieties;

      if (isSelected) {
        updatedProducts = prev.selectedProducts.filter((p) => p.id !== product.id);
        // Remove varieties that belonged to this product
        updatedVarieties = prev.selectedVarieties.filter((v) => v.productId !== product.id);
      } else {
        updatedProducts = [...prev.selectedProducts, product];
      }
      return { ...prev, selectedProducts: updatedProducts, selectedVarieties: updatedVarieties };
    });
  };

  const toggleVariety = (varietyObj) => {
    updateState((prev) => {
      const isSelected = prev.selectedVarieties.some((v) => v.id === varietyObj.id);
      const updatedVarieties = isSelected
        ? prev.selectedVarieties.filter((v) => v.id !== varietyObj.id)
        : [...prev.selectedVarieties, varietyObj];
      return { ...prev, selectedVarieties: updatedVarieties };
    });
  };

  const addWeightEntry = (entry, isPending = false) => {
    updateState((prev) => ({
      ...prev,
      weightEntries: [...prev.weightEntries, entry],
      pendingSync: isPending ? [...prev.pendingSync, entry] : prev.pendingSync
    }));
  };

  const removePendingSync = (tempId) => {
    updateState((prev) => ({
      ...prev,
      pendingSync: prev.pendingSync.filter(entry => entry.tempId !== tempId)
    }));
  };

  const syncPendingWeights = async () => {
    const { pendingSync, backendVarietyMap } = stateRef.current;
    if (pendingSync.length === 0 || !backendVarietyMap) return;

    for (const entry of [...pendingSync]) {
      const txVarietyId = backendVarietyMap[entry.varietyId];
      if (!txVarietyId) continue;

      try {
        const res = await transactionApi.addWeightEntry(txVarietyId, { weight: entry.weight });
        if (res.success) {
          updateState(prev => ({
            ...prev,
            weightEntries: prev.weightEntries.map(e =>
              e.tempId === entry.tempId ? { ...e, id: res.data.id, tempId: undefined } : e
            ),
            pendingSync: prev.pendingSync.filter(e => e.tempId !== entry.tempId)
          }));
        }
      } catch (err) {
        console.error('Failed to sync pending weight:', err);
      }
    }
  };

  const setTransactionData = (data) => {
    updateState(prev => ({ ...prev, ...data }));
  };

  const updateWeightEntry = (entryId, newWeight) => {
    updateState((prev) => ({
      ...prev,
      weightEntries: prev.weightEntries.map(entry =>
        entry.id === entryId ? { ...entry, weight: newWeight } : entry
      )
    }));
  };

  const deleteWeightEntry = (entryId) => {
    updateState((prev) => ({
      ...prev,
      weightEntries: prev.weightEntries.filter(entry => entry.id !== entryId)
    }));
  };

  // Reset all transaction state after completing a transaction
  const resetTransaction = () => {
    const fresh = { ...INITIAL_STATE };
    stateRef.current = fresh;
    setTransactionState(fresh);
  };

  return (
    <TransactionContext.Provider value={{
      transactionState,
      setParty,
      setBackendTransactionId,
      setTransactionId,
      initializeBackendTransaction,
      addProductVarietiesToTransaction,
      toggleProduct,
      toggleVariety,
      addWeightEntry,
      removePendingSync,
      syncPendingWeights,
      setTransactionData,
      updateWeightEntry,
      deleteWeightEntry,
      resetTransaction
    }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransaction must be used within a TransactionProvider');
  }
  return context;
}

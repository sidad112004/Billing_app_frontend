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
  // Fast Transaction state
  transactionMode: 'REGULAR', // 'REGULAR' | 'FAST'
  fastEntries: [],
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

  const setTransactionMode = (mode) => {
    updateState(prev => ({ ...prev, transactionMode: mode }));
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
  /**
   * Add a product+varieties to an already-initialized backend transaction.
   * Used when the operator discovers a new product or creates one while weighing.
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

      // Get current transaction products in case they were already created
      let existingTxProducts = [];
      try {
        const txRes = await transactionApi.getTransaction(txId);
        if (txRes && txRes.data && txRes.data.products) {
          existingTxProducts = txRes.data.products;
        }
      } catch (err) {
        console.warn('Could not fetch existing transaction products:', err);
      }

      // Group new varieties by product
      const productMap = {};
      newVarieties.forEach(v => {
        if (!productMap[v.productId]) productMap[v.productId] = [];
        productMap[v.productId].push(v);
      });

      for (const productId of Object.keys(productMap)) {
        let txProdId = null;

        // Check if already in transaction
        const found = existingTxProducts.find(p => p.productId === productId || p.id === productId);
        if (found) {
          txProdId = found.id;
        } else {
          try {
            const tpRes = await transactionApi.addTransactionProduct(txId, { productId });
            if (tpRes.success && tpRes.data) {
              txProdId = tpRes.data.id;
            }
          } catch (e) {
            console.warn('Failed to add product to transaction:', e);
          }
        }

        if (!txProdId) {
          console.warn('Could not get transaction product id for product', productId);
          continue;
        }

        for (const variety of productMap[productId]) {
          try {
            const tvRes = await transactionApi.addTransactionVariety(txProdId, { varietyId: variety.id });
            if (tvRes.success && tvRes.data) {
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
        selectedVarieties: [...prev.selectedVarieties.filter(v => !newVarieties.some(nv => nv.id === v.id)), ...newVarieties],
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

  const addProduct = (product) => {
    updateState((prev) => {
      const exists = prev.selectedProducts.some((p) => p.id === product.id);
      if (exists) return prev;
      return { ...prev, selectedProducts: [...prev.selectedProducts, product] };
    });
  };

  const addVariety = (varietyObj) => {
    updateState((prev) => {
      const exists = prev.selectedVarieties.some((v) => v.id === varietyObj.id);
      const updatedVarieties = exists
        ? prev.selectedVarieties
        : [...prev.selectedVarieties, varietyObj];
      
      const prodExists = prev.selectedProducts.some((p) => p.id === varietyObj.productId);
      const updatedProducts = prodExists
        ? prev.selectedProducts
        : [...prev.selectedProducts, { id: varietyObj.productId, name: varietyObj.productName }];

      return {
        ...prev,
        selectedProducts: updatedProducts,
        selectedVarieties: updatedVarieties
      };
    });
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
        (entry.id === entryId || entry.tempId === entryId) ? { ...entry, weight: newWeight } : entry
      ),
      pendingSync: prev.pendingSync.map(entry =>
        (entry.id === entryId || entry.tempId === entryId) ? { ...entry, weight: newWeight } : entry
      )
    }));
  };

  const deleteWeightEntry = (entryId) => {
    updateState((prev) => ({
      ...prev,
      weightEntries: prev.weightEntries.filter(entry => entry.id !== entryId && entry.tempId !== entryId),
      pendingSync: prev.pendingSync.filter(entry => entry.id !== entryId && entry.tempId !== entryId)
    }));
  };

  // ----------------------------------------------------------------
  // Fast Transaction Entries Management
  // ----------------------------------------------------------------
  const addFastEntry = (entry) => {
    const entryWithId = {
      ...entry,
      id: entry.id || `fast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      amount: Math.round((parseFloat(entry.weight || 0) * parseFloat(entry.rate || 0)) * 100) / 100
    };
    updateState((prev) => ({
      ...prev,
      fastEntries: [...prev.fastEntries, entryWithId]
    }));
    return entryWithId;
  };

  const updateFastEntry = (entryId, updatedFields) => {
    updateState((prev) => ({
      ...prev,
      fastEntries: prev.fastEntries.map(e => {
        if (e.id === entryId) {
          const merged = { ...e, ...updatedFields };
          const weight = parseFloat(merged.weight || 0);
          const rate = parseFloat(merged.rate || 0);
          merged.amount = Math.round((weight * rate) * 100) / 100;
          return merged;
        }
        return e;
      })
    }));
  };

  const deleteFastEntry = (entryId) => {
    updateState((prev) => ({
      ...prev,
      fastEntries: prev.fastEntries.filter(e => e.id !== entryId)
    }));
  };

  const clearFastEntries = () => {
    updateState((prev) => ({ ...prev, fastEntries: [] }));
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
      setTransactionMode,
      initializeBackendTransaction,
      addProductVarietiesToTransaction,
      addProduct,
      addVariety,
      toggleProduct,
      toggleVariety,
      addWeightEntry,
      removePendingSync,
      syncPendingWeights,
      setTransactionData,
      updateWeightEntry,
      deleteWeightEntry,
      addFastEntry,
      updateFastEntry,
      deleteFastEntry,
      clearFastEntries,
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

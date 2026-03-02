import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SYMPTOM_HISTORY_KEY } from '../constants';
import { SymptomLog } from '../types/domain';

export function useSymptoms() {
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(SYMPTOM_HISTORY_KEY);
      if (stored) {
        setLogs(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load symptom logs', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const addLog = async (log: Omit<SymptomLog, 'id' | 'createdAt'>) => {
    const newLog: SymptomLog = {
      ...log,
      id: `sym_${Date.now()}`,
      createdAt: Date.now(),
    };
    const updated = [newLog, ...logs];
    setLogs(updated);
    await AsyncStorage.setItem(SYMPTOM_HISTORY_KEY, JSON.stringify(updated));
  };

  const updateLog = async (id: string, updates: Partial<SymptomLog>) => {
    const updated = logs.map((l) => (l.id === id ? { ...l, ...updates } : l));
    setLogs(updated);
    await AsyncStorage.setItem(SYMPTOM_HISTORY_KEY, JSON.stringify(updated));
  };

  const deleteLog = async (id: string) => {
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    await AsyncStorage.setItem(SYMPTOM_HISTORY_KEY, JSON.stringify(updated));
  };

  return {
    logs,
    loading,
    addLog,
    updateLog,
    deleteLog,
    refresh: loadLogs,
  };
}

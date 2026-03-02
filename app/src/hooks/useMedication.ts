import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MEDICATION_HISTORY_KEY } from '../constants';
import { MedicationLog } from '../types/domain';

export function useMedication() {
    const [logs, setLogs] = useState<MedicationLog[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLogs = useCallback(async () => {
        try {
            const stored = await AsyncStorage.getItem(MEDICATION_HISTORY_KEY);
            if (stored) {
                setLogs(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load medication logs', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    const addLog = async (log: Omit<MedicationLog, 'id' | 'createdAt'>) => {
        const newLog: MedicationLog = {
            ...log,
            id: `med_${Date.now()}`,
            createdAt: Date.now(),
        };
        const updated = [newLog, ...logs];
        setLogs(updated);
        await AsyncStorage.setItem(MEDICATION_HISTORY_KEY, JSON.stringify(updated));
    };

    const updateLog = async (id: string, updates: Partial<MedicationLog>) => {
        const updated = logs.map(l => l.id === id ? { ...l, ...updates } : l);
        setLogs(updated);
        await AsyncStorage.setItem(MEDICATION_HISTORY_KEY, JSON.stringify(updated));
    };

    const deleteLog = async (id: string) => {
        const updated = logs.filter(l => l.id !== id);
        setLogs(updated);
        await AsyncStorage.setItem(MEDICATION_HISTORY_KEY, JSON.stringify(updated));
    };

    return {
        logs,
        loading,
        addLog,
        updateLog,
        deleteLog,
        refresh: loadLogs
    };
}

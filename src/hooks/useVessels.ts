import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VesselCalibration } from '../types/app';
import { VESSEL_PROFILES_KEY } from '../constants';
import { recalculateVesselVolume } from '../utils/vesselVolume';

const MAX_RETRIES = 3;

export function useVessels() {
    const [vesselProfiles, setVesselProfiles] = useState<VesselCalibration[]>([]);
    const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
    const [currentVessel, setCurrentVessel] = useState<VesselCalibration | null>(null);
    /** 讀取失敗時顯示 toast 訊息；null 表示無錯誤 */
    const [loadErrorToast, setLoadErrorToast] = useState<string | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        async function load(attempt = 1): Promise<void> {
            try {
                const raw = await AsyncStorage.getItem(VESSEL_PROFILES_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as VesselCalibration[];
                    // 重新計算所有容器的體積，修正可能存在的錯誤計算
                    const corrected = parsed.map(v => recalculateVesselVolume(v));
                    setVesselProfiles(corrected);

                    // 如果有修正，自動儲存修正後的資料
                    const needsSave = corrected.some((v, i) => v.volumeMl !== parsed[i]?.volumeMl);
                    if (needsSave) {
                        await AsyncStorage.setItem(VESSEL_PROFILES_KEY, JSON.stringify(corrected));
                    }

                    if (corrected.length > 0) {
                        setSelectedVesselId(corrected[0].id);
                        setCurrentVessel(corrected[0]);
                    }
                }
            } catch (e) {
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                    return load(attempt + 1);
                }
                console.error('[useVessels] 食碗資料讀取失敗（已重試 3 次）', e);
                setLoadErrorToast('食碗資料讀取失敗，進食記錄的容量計算可能不準確');
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                toastTimerRef.current = setTimeout(() => setLoadErrorToast(null), 5000);
            }
        }
        void load();
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    const saveVesselProfiles = async (next: VesselCalibration[]) => {
        // 儲存前重新計算所有容器的體積，確保資料正確
        const corrected = next.map(v => recalculateVesselVolume(v));
        setVesselProfiles(corrected);
        await AsyncStorage.setItem(VESSEL_PROFILES_KEY, JSON.stringify(corrected));

        if (selectedVesselId && !corrected.find(p => p.id === selectedVesselId)) {
            if (corrected.length > 0) {
                setSelectedVesselId(corrected[0].id);
                setCurrentVessel(corrected[0]);
            } else {
                setSelectedVesselId(null);
                setCurrentVessel(null);
            }
        }
    };

    const selectVessel = (id: string) => {
        const found = vesselProfiles.find(p => p.id === id);
        if (found) {
            // 確保選中的容器體積是正確計算的
            const corrected = recalculateVesselVolume(found);
            setSelectedVesselId(id);
            setCurrentVessel(corrected);
        }
    };

    return {
        vesselProfiles,
        selectedVesselId,
        currentVessel,
        saveVesselProfiles,
        selectVessel,
        loadErrorToast,
    };
}

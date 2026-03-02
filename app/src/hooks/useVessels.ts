import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VesselCalibration } from '../types/app';
import { VESSEL_PROFILES_KEY } from '../constants';
import { recalculateVesselVolume } from '../utils/vesselVolume';

export function useVessels() {
    const [vesselProfiles, setVesselProfiles] = useState<VesselCalibration[]>([]);
    const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
    const [currentVessel, setCurrentVessel] = useState<VesselCalibration | null>(null);

    useEffect(() => {
        async function load() {
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
            } catch (_e) { }
        }
        void load();
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
    };
}

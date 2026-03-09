import React, { useState, useMemo } from 'react';
import { Modal, Pressable, ScrollView, Text, View, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { CatIdentity, VitalsLog } from '../../types/domain';

interface Props {
    visible: boolean;
    onClose: () => void;
    cats: CatIdentity[];
    vitalsLogs: VitalsLog[];
    onSave: (catId: string, weightKg: number) => void;
}

export function WeightRecordModal({ visible, onClose, cats, vitalsLogs, onSave }: Props) {
    const [selectedCatId, setSelectedCatId] = useState(cats[0]?.id || '');
    const [weightInput, setWeightInput] = useState('');

    const lastVitalsByCat = useMemo(() => {
        const byCat: Record<string, VitalsLog | null> = {};
        const sorted = [...vitalsLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        sorted.forEach((v) => {
            if (byCat[v.catId] == null) byCat[v.catId] = v;
        });
        return byCat;
    }, [vitalsLogs]);

    const selectedCat = cats.find((c) => c.id === selectedCatId);
    const lastVitals = selectedCatId ? lastVitalsByCat[selectedCatId] : null;
    const lastRecordText = lastVitals
        ? `${new Date(lastVitals.timestamp).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })} ${new Date(lastVitals.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}，${lastVitals.weightKg.toFixed(1)} kg`
        : '尚無紀錄';

    const handleSave = () => {
        if (!selectedCatId) {
            Alert.alert('請選擇貓咪', '請先選擇要記錄體重的貓咪。');
            return;
        }
        const w = parseFloat(weightInput.replace(/,/g, '.'));
        if (Number.isNaN(w) || w <= 0 || w > 99) {
            Alert.alert('輸入錯誤', '請輸入有效的體重（0.1～99 kg）。');
            return;
        }
        onSave(selectedCatId, w);
        setWeightInput('');
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>體重記錄</Text>
                        <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        {cats.length === 0 ? (
                            <View style={styles.infoBox}>
                                <Text style={styles.infoTitle}>尚無貓咪檔案</Text>
                                <Text style={{ fontSize: 12 }}>請先至「個人」→ 新增貓咪，再記錄體重。</Text>
                            </View>
                        ) : (
                            <>
                                <View style={styles.formGroup}>
                                    <Text style={styles.formLabel}>選擇貓咪</Text>
                                    <View style={[styles.choiceRow, { flexWrap: 'wrap' }]}>
                                        {cats.map((cat) => (
                                            <Pressable
                                                key={cat.id}
                                                style={[styles.choiceBtn, selectedCatId === cat.id && styles.choiceBtnActive]}
                                                onPress={() => setSelectedCatId(cat.id)}
                                            >
                                                <Text style={[styles.choiceBtnText, selectedCatId === cat.id && styles.choiceBtnTextActive]}>
                                                    {cat.name}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>

                                {selectedCat && (
                                    <>
                                        <View style={[styles.formGroup, { backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8 }]}>
                                            <Text style={[styles.formLabel, { marginBottom: 4 }]}>上次紀錄</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <AppIcon name="schedule" size={16} color="#666" style={{ marginRight: 6 }} />
                                                <Text style={{ fontSize: 14, color: '#333' }}>{lastRecordText}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.formGroup}>
                                            <Text style={styles.formLabel}>本次體重 (kg) *</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={weightInput}
                                                onChangeText={setWeightInput}
                                                placeholder="例：4.2"
                                                keyboardType="decimal-pad"
                                            />
                                        </View>

                                        <Pressable style={styles.primaryBtn} onPress={handleSave}>
                                            <Text style={styles.primaryBtnText}>儲存體重記錄</Text>
                                        </Pressable>
                                    </>
                                )}
                            </>
                        )}
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

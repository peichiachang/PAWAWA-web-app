import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { CatIdentity } from '../../types/domain';

interface Props {
    visible: boolean;
    onClose: () => void;
    cats: CatIdentity[];
    onSave: (data: {
        catId: string;
        medicationName: string;
        dosage: string;
        notes: string;
        reminderTime?: string;
        completedAt?: string;
    }) => void;
}

export function MedicationModal({ visible, onClose, cats, onSave }: Props) {
    const [selectedCatId, setSelectedCatId] = useState(cats[0]?.id || '');
    const [medName, setMedName] = useState('');
    const [dosage, setDosage] = useState('');
    const [notes, setNotes] = useState('');
    const [reminderTime, setReminderTime] = useState('');

    const handleSave = () => {
        if (!selectedCatId || !medName || !dosage) {
            Alert.alert('錯誤', '請填寫必填欄位 (貓咪、藥名、劑量)');
            return;
        }
        onSave({
            catId: selectedCatId,
            medicationName: medName,
            dosage,
            notes,
            reminderTime: reminderTime || undefined,
            completedAt: new Date().toISOString(),
        });
        // Reset and close
        setMedName('');
        setDosage('');
        setNotes('');
        setReminderTime('');
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>投藥紀錄</Text>
                        <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <View style={styles.infoBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="medication" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.infoTitle}>記錄主子的用藥狀況</Text></View>
                            <Text style={{ fontSize: 12 }}>確保按時服藥是康復的關鍵</Text>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>選擇貓咪 *</Text>
                            <View style={styles.choiceRow}>
                                {cats.map(cat => (
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

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>藥品名稱 *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="例如：抗生素、心臟藥"
                                value={medName}
                                onChangeText={setMedName}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>劑量/用法 *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="例如：1/2 顆、2ml"
                                value={dosage}
                                onChangeText={setDosage}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>預定時間 (選填)</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="例如：08:00"
                                value={reminderTime}
                                onChangeText={setReminderTime}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>備註</Text>
                            <TextInput
                                style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
                                placeholder="例如：飯後服用、拌入肉泥"
                                multiline
                                value={notes}
                                onChangeText={setNotes}
                            />
                        </View>

                        <Pressable style={styles.primaryBtn} onPress={handleSave}>
                            <Text style={styles.primaryBtnText}>儲存投藥紀錄</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

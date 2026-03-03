import React, { useState, useEffect } from 'react';
import { Modal, Pressable, ScrollView, Text, View, TextInput, Alert, Switch, SafeAreaView } from 'react-native';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { ChronicCondition, CatIdentity } from '../../types/domain';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSave: (catData: any) => Promise<void> | void;
    initialData?: CatIdentity | null;
}

export function AddCatModal({ visible, onClose, onSave, initialData }: Props) {
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');
    const [weight, setWeight] = useState('');
    const [age, setAge] = useState('');
    const [spayedNeutered, setSpayedNeutered] = useState(true);
    const [activity, setActivity] = useState('normal');
    const [bodyCondition, setBodyCondition] = useState('ideal');
    const [chronicConditions, setChronicConditions] = useState<ChronicCondition[]>([]);
    
    function deriveAgeFromBirthDate(birthDate?: string): string {
        if (!birthDate) return '';
        const d = new Date(birthDate);
        if (Number.isNaN(d.getTime())) return '';
        const now = new Date();
        const ageYears = Math.max(0, (now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        const oneDecimal = Math.round(ageYears * 10) / 10;
        return Number.isInteger(oneDecimal) ? String(oneDecimal) : oneDecimal.toFixed(1);
    }

    useEffect(() => {
        if (visible && initialData) {
            setName(initialData.name);
            setGender(initialData.gender);
            setWeight(initialData.currentWeightKg.toString());
            setAge(deriveAgeFromBirthDate(initialData.birthDate));
            setSpayedNeutered(initialData.spayedNeutered);
            setChronicConditions(initialData.chronicConditions || []);
            // Activity and BodyCondition aren't in CatIdentity yet, but we'll keep them for UI
        } else if (visible && !initialData) {
            // Reset state for new cat
            setName('');
            setGender('');
            setWeight('');
            setAge('');
            setSpayedNeutered(true);
            setActivity('normal');
            setBodyCondition('ideal');
            setChronicConditions([]);
        }
    }, [visible, initialData]);

    const toggleChronicCondition = (condition: ChronicCondition) => {
        setChronicConditions(prev =>
            prev.includes(condition)
                ? prev.filter(c => c !== condition)
                : [...prev, condition]
        );
    };

    const handleSave = async () => {
        if (!name || !gender || !weight || !age) {
            Alert.alert('錯誤', '請填寫必填欄位');
            return;
        }
        const normalizedWeight = weight.replace(',', '.');
        const parsedWeight = parseFloat(normalizedWeight);
        if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
            Alert.alert('錯誤', '請輸入有效體重（例如 4.2）');
            return;
        }
        const normalizedAge = age.replace(',', '.');
        const parsedAge = parseFloat(normalizedAge);
        if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 30) {
            Alert.alert('錯誤', '請輸入有效年齡（0-30 歲，可含小數，例如 0.7）');
            return;
        }
        try {
            await onSave({
                ...(initialData ? { id: initialData.id } : {}),
                name,
                gender,
                weight: parsedWeight,
                age: parsedAge,
                spayedNeutered,
                activity,
                bodyCondition,
                chronicConditions,
            });
            onClose();
        } catch (error) {
            const msg = error instanceof Error ? error.message : '未知錯誤';
            Alert.alert('儲存失敗', msg);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{initialData ? '編輯貓咪檔案' : '新增貓咪檔案'}</Text>
                        <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <View style={styles.infoBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="assignment" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.infoTitle}>{initialData ? `編輯 ${name} 的檔案` : '建立新的貓咪檔案'}</Text></View>
                            <Text style={{ fontSize: 12 }}>填寫以下資料以更新個體檔案</Text>
                        </View>

                        <Text style={styles.sectionTitle}>基本資料</Text>
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>名稱 *</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="例如：小花"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>年齡 (歲) *</Text>
                            <TextInput
                                style={styles.formInput}
                                keyboardType="decimal-pad"
                                inputMode="decimal"
                                placeholder="例如：0.7"
                                value={age}
                                onChangeText={(v) => setAge(v.replace(',', '.'))}
                            />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.formLabel}>性別 *</Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <Pressable
                                        style={[styles.choiceBtn, gender === 'female' && styles.choiceBtnActive]}
                                        onPress={() => setGender('female')}
                                    >
                                        <Text style={[styles.choiceBtnText, gender === 'female' && styles.choiceBtnTextActive]}>母貓</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[styles.choiceBtn, gender === 'male' && styles.choiceBtnActive]}
                                        onPress={() => setGender('male')}
                                    >
                                        <Text style={[styles.choiceBtnText, gender === 'male' && styles.choiceBtnTextActive]}>公貓</Text>
                                    </Pressable>
                                </View>
                            </View>
                            <View style={[styles.formGroup, { flex: 1 }]}>
                                <Text style={styles.formLabel}>結紮狀態</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', height: 40 }}>
                                    <Text style={{ fontSize: 13, marginRight: 8 }}>{spayedNeutered ? '已結紮' : '未結紮'}</Text>
                                    <Switch
                                        value={spayedNeutered}
                                        onValueChange={setSpayedNeutered}
                                        trackColor={{ false: '#d1d5db', true: '#000000' }}
                                    />
                                </View>
                            </View>
                        </View>

                        <Text style={styles.sectionTitle}>體重與體況</Text>
                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>當前體重 (kg) *</Text>
                            <TextInput
                                style={styles.formInput}
                                keyboardType="decimal-pad"
                                inputMode="decimal"
                                placeholder="4.5"
                                value={weight}
                                onChangeText={setWeight}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>活動量</Text>
                            <View style={{ gap: 8 }}>
                                {['low', 'normal', 'high'].map((l) => (
                                    <Pressable
                                        key={l}
                                        style={[styles.choiceBtn, activity === l && styles.choiceBtnActive]}
                                        onPress={() => setActivity(l)}
                                    >
                                        <Text style={[styles.choiceBtnText, activity === l && styles.choiceBtnTextActive]}>
                                            {l === 'low' ? '低活動 (大部分時間睡覺)' : l === 'normal' ? '正常活動' : '高活動 (精力充沛)'}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>體況 (BCS)</Text>
                            <View style={{ gap: 8 }}>
                                {['underweight', 'ideal', 'overweight'].map((c) => (
                                    <Pressable
                                        key={c}
                                        style={[styles.choiceBtn, bodyCondition === c && styles.choiceBtnActive]}
                                        onPress={() => setBodyCondition(c)}
                                    >
                                        <Text style={[styles.choiceBtnText, bodyCondition === c && styles.choiceBtnTextActive]}>
                                            {c === 'underweight' ? '過瘦' : c === 'ideal' ? '理想' : '過胖'}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.formLabel}>病史/健康狀態 (可複選)</Text>
                            <View style={[styles.choiceRow, { flexWrap: 'wrap' }]}>
                                {[
                                    { id: 'ckd', label: '慢性腎病 (CKD)' },
                                    { id: 'diabetes', label: '糖尿病' },
                                    { id: 'hyperthyroidism', label: '甲狀腺亢進' },
                                    { id: 'obesity', label: '肥胖管理' },
                                    { id: 'fip', label: '腹膜炎 (FIP)' },
                                    { id: 'heart_disease', label: '心臟病' },
                                    { id: 'ibd', label: '腸胃炎/IBD' },
                                    { id: 'asthma', label: '氣喘/哮喘' },
                                    { id: 'flutd', label: '泌尿道疾病' },
                                ].map((cond) => (
                                    <Pressable
                                        key={cond.id}
                                        style={[
                                            styles.choiceBtn,
                                            chronicConditions.includes(cond.id as ChronicCondition) && styles.choiceBtnActive,
                                            { marginBottom: 8, marginRight: 8 }
                                        ]}
                                        onPress={() => toggleChronicCondition(cond.id as ChronicCondition)}
                                    >
                                        <Text style={[
                                            styles.choiceBtnText,
                                            chronicConditions.includes(cond.id as ChronicCondition) && styles.choiceBtnTextActive
                                        ]}>
                                            {cond.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <Pressable style={styles.primaryBtn} onPress={handleSave}>
                            <Text style={styles.primaryBtnText}>{initialData ? '儲存變更' : '建立貓咪檔案'}</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

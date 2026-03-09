import { Modal, Pressable, ScrollView, Text, View, Alert, SafeAreaView } from 'react-native';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export function IAPModal({ visible, onClose }: Props) {
    const selectPlan = (plan: string) => {
        Alert.alert('訂閱', `已選擇 ${plan} 方案。功能開發中。`);
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="star" size={22} color="#000" style={{ marginRight: 8 }} /><Text style={styles.modalTitle}>訂閱方案</Text></View>
                        <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <View style={{ backgroundColor: '#e8f5e9', borderWidth: 2, borderColor: '#2e7d32', padding: 16, marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><AppIcon name="check-circle" size={18} color="#2e7d32" style={{ marginRight: 6 }} /><Text style={{ fontWeight: '700', fontSize: 14 }}>目前方案</Text></View>
                            <Text style={{ fontSize: 13, lineHeight: 20 }}>
                                <Text style={{ fontWeight: '700' }}>免費版</Text>{'\n'}
                                • 最多 2 隻貓咪{'\n'}
                                • 手動記錄功能{'\n'}
                                • 本地數據儲存{'\n'}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <AppIcon name="cancel" size={14} color="#d32f2f" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#d32f2f', fontSize: 13 }}>無 AI 智能分析</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><AppIcon name="pets" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.sectionTitle}>升級為貓奴版</Text></View>
                        <Text style={{ fontSize: 12, color: '#666', marginBottom: 12, lineHeight: 18 }}>
                            解鎖 AI 智能分析，讓照顧貓主子更輕鬆！
                        </Text>

                        <Pressable
                            style={{ borderWidth: 2, borderColor: '#000', padding: 16, marginBottom: 12 }}
                            onPress={() => selectPlan('月訂閱')}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="pets" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={{ fontWeight: '700', fontSize: 16 }}>貓奴版 - 月訂閱</Text></View>
                                    <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>按月計費，隨時取消</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 24, fontWeight: '700' }}>NT$ 99</Text>
                                    <Text style={{ fontSize: 11, color: '#666' }}>/月</Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 12, lineHeight: 20, color: '#333' }}>
                                無限貓咪數量{'\n'}
                                AI 智能分析（每月 200 次）{'\n'}
                                雲端備份與同步{'\n'}
                                進階數據分析{'\n'}
                                智能健康提醒
                            </Text>
                        </Pressable>

                        <Pressable
                            style={{ borderWidth: 3, borderColor: '#FFD700', backgroundColor: '#FFFEF0', padding: 16, marginBottom: 16 }}
                            onPress={() => selectPlan('年訂閱')}
                        >
                            <View style={{ position: 'absolute', top: -12, right: 16, backgroundColor: '#FFD700', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700' }}>省 40%</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="pets" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={{ fontWeight: '700', fontSize: 16 }}>貓奴版 - 年訂閱</Text></View>
                                    <Text style={{ fontSize: 11, color: '#666', marginTop: 2 }}>資深貓奴首選！</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 24, fontWeight: '700' }}>NT$ 699</Text>
                                    <Text style={{ fontSize: 11, color: '#666' }}>/年</Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 12, lineHeight: 20, color: '#333' }}>
                                無限貓咪數量{'\n'}
                                AI 智能分析（每月 300 次）{'\n'}
                                雲端備份與同步{'\n'}
                                進階數據分析{'\n'}
                                <Text style={{ fontWeight: '700' }}>專屬贈品：貓咪健康手冊</Text>
                            </Text>
                        </Pressable>

                        <View style={{ backgroundColor: '#fff3cd', borderWidth: 2, borderColor: '#856404', padding: 12, marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="smart-toy" size={16} color="#856404" style={{ marginRight: 4 }} /><Text style={{ fontWeight: '700', fontSize: 13 }}>AI 智能分析說明</Text></View>
                            <Text style={{ fontSize: 11, lineHeight: 18 }}>
                                <Text style={{ fontWeight: '700' }}>AI 功能包含：</Text>{'\n'}
                                • 食物熱量辨識{'\n'}
                                • 排泄物健康分析{'\n'}
                                • 異常狀況偵測
                            </Text>
                        </View>

                        <Pressable style={styles.primaryBtn} onPress={onClose}>
                            <Text style={styles.primaryBtnText}>稍後再說</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

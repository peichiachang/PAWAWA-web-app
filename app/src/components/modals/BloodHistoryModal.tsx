import { Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { BloodReportRecord } from '../../types/bloodReport';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';

interface Props {
    visible: boolean;
    onClose: () => void;
    reports: BloodReportRecord[];
    onSelectReport: (report: BloodReportRecord) => void;
}

export function BloodHistoryModal({ visible, onClose, reports, onSelectReport }: Props) {
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>血液報告歷史</Text>
                        <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
                    </View>

                    <ScrollView style={styles.modalBody}>
                        <View style={{ marginBottom: 20 }}>
                            <Text style={{ fontSize: 13, color: '#666', lineHeight: 20 }}>
                                這裡記錄了所有貓咪過去的血檢指標。點擊單筆紀錄可查看詳細數據分析。
                            </Text>
                        </View>

                        {reports.length === 0 ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <AppIcon name="show-chart" size={48} color="#999" style={{ marginBottom: 16 }} />
                                <Text style={{ fontSize: 14, color: '#666' }}>尚無血液報告紀錄</Text>
                            </View>
                        ) : reports.map((item) => (
                            <Pressable
                                key={item.id}
                                style={{
                                    padding: 16,
                                    borderWidth: 2,
                                    borderColor: '#000',
                                    borderRadius: 8,
                                    marginBottom: 12,
                                    backgroundColor: '#fff',
                                }}
                                onPress={() => onSelectReport(item)}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' }} />
                                        <Text style={{ fontWeight: '700', fontSize: 15 }}>{item.catId === 'household' ? '全家' : '貓咪紀錄'}</Text>
                                    </View>
                                    <Text style={{ fontSize: 12, color: '#666' }}>{item.reportDate}</Text>
                                </View>

                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <AppIcon name="create" size={14} color="#666" style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 13, color: '#666' }}>包含 {item.interpretations.length} 項指標分析</Text>
                                </View>

                                <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#000', textDecorationLine: 'underline' }}>查看詳情 →</Text>
                                </View>
                            </Pressable>
                        ))}

                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: '#999' }}>
                                {reports.length > 0 ? '-- 已載入全部紀錄 --' : ''}
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

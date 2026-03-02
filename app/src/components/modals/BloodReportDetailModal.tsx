import { Image, Modal, Pressable, SafeAreaView, ScrollView, Text, View, StyleSheet } from 'react-native';
import { BloodReportRecord } from '../../types/bloodReport';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';
import { BLOOD_REPORT_DISCLAIMER } from '../../services/bloodReport';

interface Props {
    visible: boolean;
    report: BloodReportRecord | null;
    onClose: () => void;
}

export function BloodReportDetailModal({ visible, report, onClose }: Props) {
    if (!report) return null;

    // Group interpretations by category
    const categories = Array.from(new Set(report.interpretations.map(i => i.category)));

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>報告詳情：{report.reportDate}</Text>
                        <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
                    </View>

                    <ScrollView style={styles.modalBody}>
                        <View style={styles.infoBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="warning" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.infoTitle}>免責聲明</Text></View>
                            <Text style={{ fontSize: 11, color: '#666', lineHeight: 16 }}>
                                {BLOOD_REPORT_DISCLAIMER}
                            </Text>
                        </View>

                        {report.photoUri && (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={detailStyles.sectionLabel}>原始照片</Text>
                                <Image
                                    source={{ uri: report.photoUri }}
                                    style={{ width: '100%', height: 200, borderWidth: 1, borderColor: '#000' }}
                                    resizeMode="contain"
                                />
                            </View>
                        )}

                        <View style={{ marginBottom: 20 }}>
                            <Text style={detailStyles.sectionLabel}>辨識結果與分析</Text>
                            {categories.map((cat) => (
                                <View key={cat}>
                                    <Text style={detailStyles.categoryTitle}>{cat.toUpperCase()}</Text>
                                    {report.interpretations
                                        .filter((i) => i.category === cat)
                                        .map((item) => (
                                            <View key={item.code} style={detailStyles.card}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text style={{ fontWeight: '700', fontSize: 14 }}>
                                                        {item.nameZh} ({item.code})
                                                    </Text>
                                                    <View style={[
                                                        detailStyles.statusBadge,
                                                        item.status === 'high' ? detailStyles.statusHigh :
                                                            item.status === 'low' ? detailStyles.statusLow :
                                                                detailStyles.statusNormal
                                                    ]}>
                                                        <Text style={detailStyles.statusText}>
                                                            {item.value} {item.unit}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={{ fontSize: 11, color: '#666' }}>參考範圍：{item.refRange}</Text>
                                                <Text style={{ fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                                                    {item.description}
                                                </Text>
                                                {item.context && (
                                                    <View style={{ marginTop: 8, padding: 8, backgroundColor: '#fff7ed', borderLeftWidth: 3, borderLeftColor: '#f97316' }}>
                                                        <Text style={{ fontSize: 11, color: '#9a3412', fontWeight: '700' }}>臨床意義：</Text>
                                                        <Text style={{ fontSize: 11, color: '#9a3412', lineHeight: 16 }}>{item.context}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                </View>
                            ))}
                        </View>

                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                            <Text style={{ fontSize: 11, color: '#999' }}>-- 報告紀錄於 {new Date(report.createdAt).toLocaleString()} --</Text>
                        </View>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const detailStyles = StyleSheet.create({
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 8,
        color: '#525252',
    },
    categoryTitle: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'uppercase',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingBottom: 4,
        marginBottom: 8,
        marginTop: 12,
    },
    card: {
        borderWidth: 1,
        borderColor: '#d4d4d4',
        padding: 10,
        marginBottom: 8,
        gap: 4,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusNormal: { backgroundColor: '#22c55e' },
    statusHigh: { backgroundColor: '#ef4444' },
    statusLow: { backgroundColor: '#f59e0b' },
    statusText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});

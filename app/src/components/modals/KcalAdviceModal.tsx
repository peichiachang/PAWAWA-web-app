import { Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';

interface Props {
    visible: boolean;
    onClose: () => void;
    currentKcal: number;
    goalKcal: number;
}

export function KcalAdviceModal({ visible, onClose, currentKcal, goalKcal }: Props) {
    const percent = Math.round((currentKcal / goalKcal) * 100);
    const remaining = Math.max(0, goalKcal - currentKcal);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="bar-chart" size={22} color="#000" style={{ marginRight: 8 }} /><Text style={styles.modalTitle}>熱量攝取分析</Text></View>
                        <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <View style={{ borderWidth: 2, borderColor: '#000', padding: 16, marginBottom: 16, alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, marginBottom: 8 }}>今日攝取</Text>
                            <Text style={{ fontSize: 48, fontWeight: '700', lineHeight: 48 }}>{Math.round(currentKcal)}</Text>
                            <Text style={{ fontSize: 14, marginTop: 4 }}>kcal / {goalKcal} kcal</Text>
                            <Text style={{ fontSize: 32, fontWeight: '700', marginTop: 12, color: '#666' }}>{percent}%</Text>
                        </View>
                        <View style={{ borderWidth: 1, borderColor: '#000', backgroundColor: '#f8fafc', padding: 10, marginBottom: 16 }}>
                            <Text style={{ fontSize: 12, lineHeight: 18, color: '#334155' }}>
                                此熱量目標為起始建議，需依體況與主治獸醫評估調整。若處於疾病管理（例如甲亢/減重期），請定期依體重與肌肉狀態回調。
                            </Text>
                        </View>

                        {percent < 100 && (
                            <View style={{ backgroundColor: '#fff3cd', borderWidth: 2, borderColor: '#856404', padding: 16, marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><AppIcon name="warning" size={18} color="#856404" style={{ marginRight: 6 }} /><Text style={{ fontWeight: '700', fontSize: 14 }}>攝取不足</Text></View>
                                <Text style={{ fontSize: 13, lineHeight: 1.6 }}>
                                    當前攝取量僅達目標的 {percent}%，距離每日建議量還差 <Text style={{ fontWeight: '700' }}>{remaining} kcal</Text>。
                                </Text>
                            </View>
                        )}

                        <Text style={styles.sectionTitle}>可能造成的問題</Text>
                        <View style={{ borderWidth: 1, borderColor: '#000', padding: 12, marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="warning" size={14} color="#000" style={{ marginRight: 4 }} /><Text style={{ fontWeight: '700', fontSize: 13 }}>短期影響（數天內）</Text></View>
                            <Text style={{ fontSize: 12, lineHeight: 1.6 }}>
                                • 精神不振、活動力下降{'\n'}
                                • 體重快速下降{'\n'}
                                • 飢餓行為增加（哀叫、翻找食物）
                            </Text>
                        </View>

                        <View style={{ borderWidth: 1, borderColor: '#000', padding: 12, marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="warning" size={14} color="#000" style={{ marginRight: 4 }} /><Text style={{ fontWeight: '700', fontSize: 13 }}>長期影響（數週以上）</Text></View>
                            <Text style={{ fontSize: 12, lineHeight: 1.6 }}>
                                • 肌肉量流失{'\n'}
                                • 免疫力下降，容易生病{'\n'}
                                • 毛髮品質變差、皮膚問題{'\n'}
                                • 器官功能受損
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}><AppIcon name="lightbulb" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.sectionTitle}>建議改善方式</Text></View>
                        <View style={{ borderWidth: 2, borderColor: '#000', padding: 12, marginBottom: 8, backgroundColor: '#f9f9f9' }}>
                            <Text style={{ fontWeight: '700', marginBottom: 8, fontSize: 13 }}>1. 增加餵食頻率</Text>
                            <Text style={{ fontSize: 12, lineHeight: 1.6 }}>
                                • 從 2 餐改為 3-4 餐{'\n'}
                                • 少量多餐更符合貓咪天性
                            </Text>
                        </View>

                        <View style={{ borderWidth: 2, borderColor: '#000', padding: 12, marginBottom: 8, backgroundColor: '#f9f9f9' }}>
                            <Text style={{ fontWeight: '700', marginBottom: 8, fontSize: 13 }}>2. 提高食物適口性</Text>
                            <Text style={{ fontSize: 12, lineHeight: 1.6 }}>
                                • 加溫食物（約 37°C）{'\n'}
                                • 混合濕食增加香氣{'\n'}
                                • 嘗試不同品牌或口味
                            </Text>
                        </View>

                        <Pressable style={styles.primaryBtn} onPress={onClose}>
                            <Text style={styles.primaryBtnText}>我知道了</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

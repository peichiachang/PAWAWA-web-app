import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';

interface Props {
    visible: boolean;
    onClose: () => void;
    currentWater: number;
    goalWater: number;
}

export function WaterAdviceModal({ visible, onClose, currentWater, goalWater }: Props) {
    const percent = Math.round((currentWater / goalWater) * 100);
    const remaining = Math.max(0, goalWater - currentWater);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="opacity" size={22} color="#000" style={{ marginRight: 8 }} /><Text style={styles.modalTitle}>飲水量分析</Text></View>
                        <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        <View style={{ borderWidth: 2, borderColor: '#000', padding: 16, marginBottom: 16, alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, marginBottom: 8 }}>今日飲水</Text>
                            <Text style={{ fontSize: 48, fontWeight: '700', lineHeight: 48 }}>{Math.round(currentWater)}</Text>
                            <Text style={{ fontSize: 14, marginTop: 4 }}>ml / {goalWater} ml</Text>
                            <Text style={{ fontSize: 32, fontWeight: '700', marginTop: 12, color: '#666' }}>{percent}%</Text>
                        </View>
                        <View style={{ borderWidth: 1, borderColor: '#000', backgroundColor: '#f8fafc', padding: 10, marginBottom: 16 }}>
                            <Text style={{ fontSize: 12, lineHeight: 18, color: '#334155' }}>
                                飲水數值為起始參考，慢性病（特別是 CKD、糖尿病、FLUTD）請依主治獸醫建議調整。濕食與皮下輸液也應納入總水分評估。
                            </Text>
                        </View>

                        {percent < 100 && (
                            <View style={{ backgroundColor: '#fff3cd', borderWidth: 2, borderColor: '#856404', padding: 16, marginBottom: 16 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><AppIcon name="warning" size={18} color="#856404" style={{ marginRight: 6 }} /><Text style={{ fontWeight: '700', fontSize: 14 }}>飲水不足</Text></View>
                                <Text style={{ fontSize: 13, lineHeight: 20 }}>
                                    當前飲水量僅達目標的 {percent}%，距離每日建議量還差 <Text style={{ fontWeight: '700' }}>{remaining} ml</Text>。
                                </Text>
                            </View>
                        )}

                        <Text style={styles.sectionTitle}>可能造成的問題</Text>
                        <View style={{ borderWidth: 1, borderColor: '#000', padding: 12, marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="warning" size={14} color="#000" style={{ marginRight: 4 }} /><Text style={{ fontWeight: '700', fontSize: 13 }}>短期影響</Text></View>
                            <Text style={{ fontSize: 12, lineHeight: 18 }}>
                                • 尿液濃縮、顏色變深{'\n'}
                                • 排尿次數減少{'\n'}
                                • 便秘風險增加
                            </Text>
                        </View>

                        <View style={{ borderWidth: 1, borderColor: '#000', padding: 12, marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}><AppIcon name="warning" size={14} color="#000" style={{ marginRight: 4 }} /><Text style={{ fontWeight: '700', fontSize: 13 }}>長期影響</Text></View>
                            <Text style={{ fontSize: 12, lineHeight: 18 }}>
                                • 泌尿系統結石風險提高{'\n'}
                                • 膀胱炎、尿道炎{'\n'}
                                • 腎臟負擔加重
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}><AppIcon name="lightbulb" size={18} color="#000" style={{ marginRight: 6 }} /><Text style={styles.sectionTitle}>建議改善方式</Text></View>
                        <View style={{ borderWidth: 2, borderColor: '#000', padding: 12, marginBottom: 8, backgroundColor: '#f9f9f9' }}>
                            <Text style={{ fontWeight: '700', marginBottom: 8, fontSize: 13 }}>1. 增加水源吸引力</Text>
                            <Text style={{ fontSize: 12, lineHeight: 18 }}>
                                • 使用流動飲水機{'\n'}
                                • 多處放置水碗{'\n'}
                                • 每天更換新鮮水
                            </Text>
                        </View>

                        <View style={{ borderWidth: 2, borderColor: '#000', padding: 12, marginBottom: 8, backgroundColor: '#f9f9f9' }}>
                            <Text style={{ fontWeight: '700', marginBottom: 8, fontSize: 13 }}>2. 增加濕食比例</Text>
                            <Text style={{ fontSize: 12, lineHeight: 18 }}>
                                • 濕食含水量 70-80%{'\n'}
                                • 乾糧混合水或肉湯
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

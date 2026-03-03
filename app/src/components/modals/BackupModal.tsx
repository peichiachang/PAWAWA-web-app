import { Modal, Pressable, ScrollView, Text, View, Alert, SafeAreaView } from 'react-native';
import { styles } from '../../styles/common';
import { AppIcon } from '../AppIcon';

interface Props {
    visible: boolean;
    onClose: () => void;
    isPro: boolean;
    onUpgrade: () => void;
}

export function BackupModal({ visible, onClose, isPro, onUpgrade }: Props) {
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
            <SafeAreaView style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="save" size={22} color="#000" style={{ marginRight: 8 }} /><Text style={styles.modalTitle}>資料備份</Text></View>
                        <Pressable onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
                    </View>
                    <ScrollView style={styles.modalBody}>
                        {!isPro ? (
                            <View>
                                <View style={{ backgroundColor: '#fff3cd', borderWidth: 2, borderColor: '#856404', padding: 16, marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><AppIcon name="warning" size={18} color="#856404" style={{ marginRight: 6 }} /><Text style={{ fontWeight: '700', fontSize: 14 }}>免費版限制</Text></View>
                                    <Text style={{ fontSize: 13, lineHeight: 20 }}>
                                        免費版<Text style={{ fontWeight: '700' }}>不提供備份功能</Text>{'\n'}
                                        資料僅儲存在本裝置中
                                    </Text>
                                </View>

                                <Text style={styles.sectionTitle}>這表示什麼？</Text>
                                <View style={{ borderWidth: 2, borderColor: '#d32f2f', padding: 16, marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><AppIcon name="cancel" size={18} color="#d32f2f" style={{ marginRight: 6 }} /><Text style={{ fontWeight: '700', fontSize: 14, color: '#d32f2f' }}>換手機會遺失資料</Text></View>
                                    <Text style={{ fontSize: 12, lineHeight: 18, color: '#333' }}>
                                        • 換新手機 → 所有記錄消失{'\n'}
                                        • 刪除 App → 資料無法復原{'\n'}
                                        • 手機故障 → 記錄全部遺失{'\n'}
                                        • 多裝置 → 無法同步查看
                                    </Text>
                                </View>

                                <View style={{ backgroundColor: '#e3f2fd', borderWidth: 2, borderColor: '#1976d2', padding: 16, marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><AppIcon name="cloud" size={18} color="#1976d2" style={{ marginRight: 6 }} /><Text style={{ fontWeight: '700', fontSize: 14 }}>升級即享雲端備份</Text></View>
                                    <Text style={{ fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
                                        升級到 <Text style={{ fontWeight: '700' }}>貓奴版</Text>，您的資料將：{'\n'}
                                        • 自動備份到雲端{'\n'}
                                        • 跨裝置同步（手機、平板）{'\n'}
                                        • 換手機自動還原
                                    </Text>
                                    <Pressable style={styles.primaryBtn} onPress={onUpgrade}>
                                        <Text style={styles.primaryBtnText}>升級為貓奴版</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <View>
                                <View style={{ backgroundColor: '#e8f5e9', borderWidth: 2, borderColor: '#2e7d32', padding: 16, marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><AppIcon name="check-circle" size={18} color="#2e7d32" style={{ marginRight: 6 }} /><Text style={{ fontWeight: '700', fontSize: 14 }}>雲端備份已啟用</Text></View>
                                    <Text style={{ fontSize: 13, lineHeight: 20 }}>
                                        您的資料已自動備份到雲端{'\n'}
                                        換手機或使用其他裝置都能同步查看
                                    </Text>
                                </View>

                                <Text style={styles.sectionTitle}>備份狀態</Text>
                                <View style={{ borderWidth: 2, borderColor: '#000', padding: 16, marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 14 }}>最後備份時間</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="check-circle" size={14} color="#2e7d32" style={{ marginRight: 4 }} /><Text style={{ fontSize: 13, color: '#2e7d32' }}>剛才</Text></View>
                                    </View>
                                    <Text style={{ fontSize: 12, lineHeight: 18, color: '#333', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#ddd' }}>
                                        自動備份已啟用{'\n'}
                                        已備份：2 隻貓咪，158 筆記錄{'\n'}
                                        雲端儲存：12.5 MB
                                    </Text>
                                    <View style={{ marginTop: 12 }}>
                                        <Text style={{ fontWeight: '700', marginBottom: 8, fontSize: 13 }}>備份位置</Text>
                                        <View style={{ padding: 8, backgroundColor: '#f5f5f5', marginBottom: 4 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}><AppIcon name="cloud" size={12} color="#333" style={{ marginRight: 4 }} /><Text style={{ fontSize: 12 }}><Text style={{ fontWeight: '700' }}>iOS 裝置：</Text>iCloud Drive</Text></View>
                                        </View>
                                    </View>
                                </View>

                                <Pressable style={styles.primaryBtn} onPress={() => Alert.alert('備份', '手動備份完成。')}>
                                    <Text style={styles.primaryBtnText}>立即手動備份</Text>
                                </Pressable>
                            </View>
                        )}

                        <Pressable style={[styles.primaryBtn, styles.primaryBtnOutline, { marginTop: 8 }]} onPress={onClose}>
                            <Text style={[styles.primaryBtnText, styles.primaryBtnOutlineText]}>關閉</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

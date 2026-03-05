import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { CatIdentity } from '../types/domain';
import { ActiveModal } from '../types/app';
import { styles } from '../styles/common';
import { AppIcon } from './AppIcon';

interface Props {
    cats: CatIdentity[];
    onOpenModal: (modal: ActiveModal) => void;
    /** 點擊家庭成員時開啟該貓咪的編輯檔案 */
    onEditCat?: (cat: CatIdentity) => void;
    onOpenVesselCalibration?: () => void;
}

export function ProfileContent({ cats, onOpenModal, onEditCat, onOpenVesselCalibration }: Props) {
    return (
        <ScrollView>
            {/* Header with System Button */}
            <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#000' }}>
                <Text style={{ fontSize: 18, fontWeight: '700' }}>個人檔案</Text>
                <Pressable
                    onPress={() => onOpenModal('settings')}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderWidth: 2, borderColor: '#000', borderRadius: 20, backgroundColor: 'white' }}
                >
                    <AppIcon name="settings" size={18} color="#000" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '500' }}>系統</Text>
                </Pressable>
            </View>

            <View style={{ padding: 16 }}>
                {/* User Info */}
                <View style={{ padding: 12, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#ddd', marginBottom: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <AppIcon name="person" size={32} color="#000" />
                    <View>
                        <Text style={{ fontSize: 14, fontWeight: '500' }}>專業貓奴</Text>
                        <Text style={{ fontSize: 11, color: '#666' }}>care@pawawa.cat</Text>
                    </View>
                </View>

                {/* My Household */}
                <Text style={styles.sectionTitle}>我的家庭</Text>
                <View style={{ borderWidth: 2, borderColor: '#000', padding: 16, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontWeight: '700', fontSize: 14 }}>家庭成員</Text>
                        <Text style={{ fontSize: 13, color: '#666' }}>{cats.length} 隻貓咪</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                        {cats.map(cat => (
                            <Pressable
                                key={cat.id}
                                onPress={() => onEditCat?.(cat)}
                                style={({ pressed }) => ({
                                    width: '48%',
                                    padding: 12,
                                    borderWidth: 1,
                                    borderColor: '#000',
                                    alignItems: 'center',
                                    marginBottom: 8,
                                    backgroundColor: pressed ? '#f0f0f0' : '#fff',
                                    borderRadius: 8,
                                })}
                            >
                                <AppIcon name="pets" size={24} color="#000" style={{ marginBottom: 4 }} />
                                <Text style={{ fontSize: 13, fontWeight: '700' }}>{cat.name}</Text>
                                <Text style={{ fontSize: 11, color: '#666' }}>{cat.currentWeightKg}kg • {cat.gender === 'male' ? '公' : '母'}</Text>
                                {onEditCat && (
                                    <Text style={{ fontSize: 10, color: '#666', marginTop: 4 }}>點擊可編輯檔案</Text>
                                )}
                            </Pressable>
                        ))}
                        {cats.length < 5 && (
                            <Pressable
                                onPress={() => onOpenModal('addCat')}
                                style={{ width: cats.length === 0 ? '100%' : '48%', padding: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#000', alignItems: 'center', justifyContent: 'center', height: 80 }}
                            >
                                <Text style={{ fontSize: 24 }}>+</Text>
                                <Text style={{ fontSize: 11 }}>新增貓咪</Text>
                            </Pressable>
                        )}
                    </View>
                </View>

                {/* 食碗管理 */}
                {onOpenVesselCalibration && (
                    <View style={{ marginBottom: 16 }}>
                        <Pressable
                            onPress={onOpenVesselCalibration}
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: '#000', borderRadius: 8, backgroundColor: '#fff' }}
                        >
                            <AppIcon name="straighten" size={24} color="#000" style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '700' }}>食碗管理</Text>
                                <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>校準食碗／水碗容量，提高 AI 辨識準確度</Text>
                            </View>
                            <AppIcon name="chevron-right" size={20} color="#666" />
                        </Pressable>
                    </View>
                )}

                {/* 罐頭庫／飼料設定 */}
                <View style={{ marginBottom: 16 }}>
                    <Pressable
                        onPress={() => onOpenModal('canLibrary')}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: '#000', borderRadius: 8, backgroundColor: '#fff', marginBottom: 8 }}
                    >
                        <AppIcon name="list" size={24} color="#000" style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700' }}>罐頭庫</Text>
                            <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>管理罐頭清單，記錄時直接選取</Text>
                        </View>
                        <AppIcon name="chevron-right" size={20} color="#666" />
                    </Pressable>
                    <Pressable
                        onPress={() => onOpenModal('feedLibrary')}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: '#000', borderRadius: 8, backgroundColor: '#fff' }}
                    >
                        <AppIcon name="restaurant" size={24} color="#000" style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700' }}>飼料設定</Text>
                            <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>儲存飼料成份熱量，記錄時帶入</Text>
                        </View>
                        <AppIcon name="chevron-right" size={20} color="#666" />
                    </Pressable>
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>快捷功能</Text>
                <View style={styles.actionGrid}>
                    <Pressable style={styles.actionBtn} onPress={() => onOpenModal('iap')}>
                        <AppIcon name="star" size={24} color="#000" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>訂閱方案</Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => onOpenModal('bloodHistory')}>
                        <AppIcon name="history" size={24} color="#000" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>血檢歷史</Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => Alert.alert('報告', '報告功能僅在個體檔案中匯出。')}>
                        <AppIcon name="bar-chart" size={24} color="#000" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>匯出報告</Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => onOpenModal('backup')}>
                        <AppIcon name="save" size={24} color="#000" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>資料備份</Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => Alert.alert('通知', '功能開發中。')}>
                        <AppIcon name="notifications" size={24} color="#000" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>通知設定</Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => Alert.alert('關於', 'PAWAWA v1.6')}>
                        <AppIcon name="info" size={24} color="#000" style={styles.actionIcon} />
                        <Text style={styles.actionLabel}>關於</Text>
                    </Pressable>
                </View>

                {/* Version Info */}
                <View style={{ marginTop: 32, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#999', textAlign: 'center' }}>
                        PAWAWA v1.6{'\n'}
                        © 2026 貓咪照護系統
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

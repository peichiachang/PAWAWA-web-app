import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { CatIdentity } from '../types/domain';
import { ActiveModal } from '../types/app';
import { styles, palette } from '../styles/common';
import { AppIcon } from './AppIcon';
import { useAuth } from '../contexts/AuthContext';
import { AnimatedPressable } from './AnimatedPressable';
import { FadeInView } from './FadeInView';

interface Props {
    cats: CatIdentity[];
    onOpenModal: (modal: ActiveModal) => void;
    /** 點擊家庭成員時開啟該貓咪的編輯檔案 */
    onEditCat?: (cat: CatIdentity) => void;
    onOpenVesselCalibration?: () => void;
}

export function ProfileContent({ cats, onOpenModal, onEditCat, onOpenVesselCalibration }: Props) {
    const { user, logout } = useAuth();
    const accountDisplay = user?.email || user?.phone || user?.id || '';

    const handleLogout = () => {
        Alert.alert('登出', '確定要登出嗎？', [
            { text: '取消', style: 'cancel' },
            { text: '登出', style: 'destructive', onPress: () => logout() },
        ]);
    };

    return (
        <ScrollView>
            {/* Header with System Button */}
            <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: palette.border }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>個人檔案</Text>
                <AnimatedPressable
                    onPress={() => onOpenModal('settings')}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderWidth: 2, borderColor: palette.border, borderRadius: 20, backgroundColor: palette.surface }}
                >
                    <AppIcon name="settings" size={18} color={palette.text} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '500', color: palette.text }}>系統</Text>
                </AnimatedPressable>
            </View>

            <FadeInView style={{ padding: 16 }} duration={300} delay={50}>
                {/* User Info + 登出 */}
                <View style={{ padding: 12, backgroundColor: palette.surfaceSoft, borderWidth: 1, borderColor: palette.border, marginBottom: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <AppIcon name="person" size={32} color={palette.text} />
                        <View>
                            <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>{accountDisplay || '已登入'}</Text>
                            <Text style={{ fontSize: 11, color: palette.muted }}>ID: {user?.id?.slice(0, 8)}…</Text>
                        </View>
                    </View>
                    <AnimatedPressable onPress={handleLogout} style={{ paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: palette.dangerText, borderRadius: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: palette.dangerText }}>登出</Text>
                    </AnimatedPressable>
                </View>

                {/* My Household */}
                <Text style={styles.sectionTitle}>我的家庭</Text>
                <View style={{ borderWidth: 2, borderColor: palette.border, padding: 16, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={{ fontWeight: '700', fontSize: 14, color: palette.text }}>家庭成員</Text>
                        <Text style={{ fontSize: 13, color: palette.muted }}>{cats.length} 隻貓咪</Text>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
                        {cats.map(cat => (
                            <AnimatedPressable
                                key={cat.id}
                                onPress={() => onEditCat?.(cat)}
                                style={{ width: '48%', minWidth: 120, padding: 12, borderWidth: 1, borderColor: palette.border, alignItems: 'center', backgroundColor: palette.surface, borderRadius: 8 }}
                            >
                                <AppIcon name="pets" size={24} color={palette.text} style={{ marginBottom: 4 }} />
                                <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }} numberOfLines={1} ellipsizeMode="tail">{cat.name}</Text>
                                <Text style={{ fontSize: 11, color: palette.muted }} numberOfLines={1}>{cat.currentWeightKg}kg • {cat.gender === 'male' ? '公' : '母'}</Text>
                            </AnimatedPressable>
                        ))}
                        {cats.length < 5 && (
                            <AnimatedPressable
                                onPress={() => onOpenModal('addCat')}
                                style={{ width: cats.length === 0 ? '100%' : '48%', minWidth: 120, minHeight: 80, padding: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
                            >
                                <Text style={{ fontSize: 24, color: palette.text }}>+</Text>
                                <Text style={{ fontSize: 11, color: palette.muted, writingDirection: 'ltr' }} numberOfLines={1}>新增貓咪</Text>
                            </AnimatedPressable>
                        )}
                    </View>
                </View>

                {/* 食碗管理 */}
                {onOpenVesselCalibration && (
                    <View style={{ marginBottom: 16 }}>
                        <AnimatedPressable
                            onPress={onOpenVesselCalibration}
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.surface }}
                        >
                            <AppIcon name="straighten" size={24} color="#000" style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '700' }}>食碗管理</Text>
                                <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>校準食碗／水碗容量，提高 AI 辨識準確度</Text>
                            </View>
                            <AppIcon name="chevron-right" size={20} color={palette.muted} />
                        </AnimatedPressable>
                    </View>
                )}

                {/* 罐頭庫／飼料設定 */}
                <View style={{ marginBottom: 16 }}>
                    <AnimatedPressable
                        onPress={() => onOpenModal('canLibrary')}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.surface, marginBottom: 8 }}
                    >
                        <AppIcon name="list" size={24} color={palette.text} style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>罐頭庫</Text>
                            <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>管理罐頭清單，記錄時直接選取</Text>
                        </View>
                        <AppIcon name="chevron-right" size={20} color={palette.muted} />
                    </AnimatedPressable>
                    <AnimatedPressable
                        onPress={() => onOpenModal('feedLibrary')}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: palette.border, borderRadius: 8, backgroundColor: palette.surface, marginBottom: 8 }}
                    >
                        <AppIcon name="restaurant" size={24} color={palette.text} style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>飼料設定</Text>
                            <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>儲存飼料成份熱量，記錄時帶入</Text>
                        </View>
                        <AppIcon name="chevron-right" size={20} color={palette.muted} />
                    </AnimatedPressable>
                    {/* 辨識測試：相機／上傳照片 → AI 分析（食物、飲水、排泄、血液報告），測試用入口 */}
                    <AnimatedPressable
                        onPress={() => onOpenModal('recognitionTest')}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 2, borderColor: palette.primary, borderRadius: 8, backgroundColor: palette.surface }}
                    >
                        <AppIcon name="camera-alt" size={24} color={palette.primary} style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>辨識測試</Text>
                            <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>相機／上傳照片，測試食物、飲水、排泄、血液報告 AI 辨識</Text>
                        </View>
                        <AppIcon name="chevron-right" size={20} color={palette.muted} />
                    </AnimatedPressable>
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>快捷功能</Text>
                <View style={styles.actionGrid}>
                    <AnimatedPressable style={styles.actionBtn} onPress={() => onOpenModal('iap')}>
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <AppIcon name="star" size={24} color="#1C2B25" style={{ marginBottom: 6 }} />
                            <Text style={styles.actionLabel}>訂閱方案</Text>
                        </View>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.actionBtn} onPress={() => onOpenModal('bloodHistory')}>
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <AppIcon name="history" size={24} color="#1C2B25" style={{ marginBottom: 6 }} />
                            <Text style={styles.actionLabel}>血檢歷史</Text>
                        </View>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.actionBtn} onPress={() => Alert.alert('報告', '報告功能僅在個體檔案中匯出。')}>
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <AppIcon name="bar-chart" size={24} color="#1C2B25" style={{ marginBottom: 6 }} />
                            <Text style={styles.actionLabel}>匯出報告</Text>
                        </View>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.actionBtn} onPress={() => onOpenModal('backup')}>
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <AppIcon name="save" size={24} color="#1C2B25" style={{ marginBottom: 6 }} />
                            <Text style={styles.actionLabel}>資料備份</Text>
                        </View>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.actionBtn} onPress={() => Alert.alert('通知', '功能開發中。')}>
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <AppIcon name="notifications" size={24} color="#1C2B25" style={{ marginBottom: 6 }} />
                            <Text style={styles.actionLabel}>通知設定</Text>
                        </View>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.actionBtn} onPress={() => Alert.alert('關於', 'PAWAWA v1.6')}>
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <AppIcon name="info" size={24} color="#1C2B25" style={{ marginBottom: 6 }} />
                            <Text style={styles.actionLabel}>關於</Text>
                        </View>
                    </AnimatedPressable>
                </View>

                {/* Version Info */}
                <View style={{ marginTop: 32, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: palette.muted, textAlign: 'center' }}>
                        PAWAWA v1.6{'\n'}
                        © 2026 貓咪照護系統
                    </Text>
                </View>
            </FadeInView>
        </ScrollView>
    );
}

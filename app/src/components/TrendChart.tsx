import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppIcon } from './AppIcon';

interface DataPoint {
  label: string;
  value: number;
  errorMargin?: number;
  hasRecord?: boolean;
  lowConfidence?: boolean;
}

interface Props {
  title: string;
  data: DataPoint[];
  goal: number;
  unit: string;
  color?: string;
  recordsComplete?: number;
}

/**
 * 趨勢圖：以「目標達成率」呈現，每個長條高度固定 = 目標 100%
 * - 填色部分 = 實際達成率（實際 / 目標）
 * - 填滿 = 達標，未滿 = 不足
 * - 超過目標時填滿並顯示綠色標記
 */
export function TrendChart({ title, data, goal, unit, color = '#000', recordsComplete }: Props) {
  return (
    <View style={chartStyles.container}>
      <Text style={chartStyles.title}>{title}</Text>
      <Text style={chartStyles.subtitle}>填色 = 達成率，長條頂端 = 目標</Text>

      <View style={chartStyles.chartArea}>
        {/* 目標線：長條頂端 = 目標 */}
        <View style={chartStyles.goalLine} pointerEvents="none" />

        {data.map((dp, idx) => {
          const hasRecord = dp.hasRecord !== false;
          const isNoRecord = dp.value === 0 && !hasRecord;
          const achievementRate = goal > 0 ? dp.value / goal : 0;
          const fillPercent = Math.min(100, achievementRate * 100);
          const isOverGoal = dp.value >= goal;

          return (
            <View key={idx} style={chartStyles.barContainer}>
              <View style={chartStyles.barWrapper}>
                {/* 填色：達成率 */}
                <View
                  style={[
                    chartStyles.bar,
                    {
                      height: `${fillPercent}%`,
                      backgroundColor: isNoRecord ? '#ddd' : color,
                      opacity: isNoRecord ? 0.5 : 1,
                    },
                    dp.lowConfidence && { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
                  ]}
                />
                {/* 超過目標時顯示綠色標記 */}
                {isOverGoal && hasRecord && (
                  <View style={chartStyles.overGoalBadge}>
                    <Text style={chartStyles.overGoalText}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={[chartStyles.label, isNoRecord && chartStyles.labelNoRecord]}>
                {dp.label}
              </Text>
              <Text style={[chartStyles.valueLabel, isNoRecord && chartStyles.labelNoRecord]}>
                {isNoRecord ? '—' : `${dp.value} ${unit}`}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={chartStyles.footer}>
        <Text style={chartStyles.info}>目標 {goal} {unit}</Text>
        {recordsComplete !== undefined && (
          <Text style={chartStyles.info}>有記錄 {recordsComplete}/{data.length} 天</Text>
        )}
      </View>

      {data.some(d => d.errorMargin && d.errorMargin > 0) && (
        <View style={chartStyles.disclaimer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <AppIcon name="warning" size={12} color="#856404" style={{ marginRight: 4 }} />
            <Text style={chartStyles.disclaimerText}>
              數據為 AI 估算，誤差約 ±{Math.round((data.find(d => d.errorMargin)?.errorMargin || 0) * 100)}%。僅供參考。
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: '#000',
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  chartArea: {
    height: 140,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    gap: 6,
  },
  goalLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 0,
    height: 1,
    backgroundColor: '#999',
    zIndex: 1,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 60,
  },
  bar: {
    width: '100%',
  },
  overGoalBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overGoalText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    color: '#333',
    fontWeight: '600',
  },
  valueLabel: {
    fontSize: 9,
    marginTop: 2,
    color: '#666',
  },
  labelNoRecord: {
    color: '#999',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  info: {
    fontSize: 10,
    color: '#666',
  },
  disclaimer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 4,
  },
  disclaimerText: {
    fontSize: 9,
    color: '#856404',
    lineHeight: 14,
    textAlign: 'center',
  },
});

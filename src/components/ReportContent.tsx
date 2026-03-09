import { Text, View } from 'react-native';
import { ClinicalSummary } from '../types/domain';
import { styles } from '../styles/common';

interface Props {
  summaries: ClinicalSummary[];
}

export function ReportContent({ summaries }: Props) {
  return (
    <View style={styles.cardBlock}>
      <Text style={styles.cardTitle}>14 天診前摘要</Text>
      {summaries.map((summary) => (
        <View key={summary.catId} style={styles.recordItem}>
          <Text style={styles.recordTitle}>{summary.catId}</Text>
          <Text style={styles.recordDesc}>
            平均體溫 {summary.avgTemperatureC.toFixed(2)}°C | 攝取 {summary.totalKcalIntake.toFixed(0)} kcal |
            體重週變化 {summary.weeklyWeightChangeRatePct.toFixed(2)}%
          </Text>
          <Text style={styles.recordDesc}>警示數量：{summary.alerts.length}</Text>
        </View>
      ))}
    </View>
  );
}

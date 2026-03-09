import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClinicalSummary } from '../types/domain';

type Props = {
  summaries: ClinicalSummary[];
};

export function SummaryScreen({ summaries }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>M3 - Clinical Summary (14 days)</Text>
      {summaries.map((summary) => (
        <View key={summary.catId} style={styles.card}>
          <Text style={styles.subtitle}>Cat ID: {summary.catId}</Text>
          <Text style={styles.line}>Avg temperature: {summary.avgTemperatureC.toFixed(2)} C</Text>
          <Text style={styles.line}>Total kcal intake: {summary.totalKcalIntake.toFixed(1)} kcal</Text>
          <Text style={styles.line}>Total hydration: {summary.totalActualWaterMl.toFixed(1)} ml</Text>
          <Text style={styles.line}>Weekly weight change: {summary.weeklyWeightChangeRatePct.toFixed(2)}%</Text>
          <Text style={styles.alertHeader}>Alerts: {summary.alerts.length}</Text>
          {summary.alerts.length === 0 && <Text style={styles.line}>No active alerts.</Text>}
          {summary.alerts.map((alert) => (
            <Text key={alert.alertId} style={styles.alertLine}>
              [{alert.severity.toUpperCase()}] {alert.type}: {alert.message}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    gap: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  line: {
    fontSize: 14,
    color: '#374151',
  },
  alertHeader: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#7f1d1d',
  },
  alertLine: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 18,
  },
});

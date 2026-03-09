import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FeedingLog } from '../types/domain';
import { calculateDailyKcalIntake } from '../utils/health';

type Props = {
  feedingLogs: FeedingLog[];
};

export function FeedingScreen({ feedingLogs }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>M1 - AI Vision & Nutrition</Text>
      {feedingLogs.map((log) => {
        const kcal = calculateDailyKcalIntake(log.intakeGram, log.kcalPerGram);
        return (
          <View key={log.sessionId} style={styles.card}>
            <Text style={styles.subtitle}>Session: {log.sessionId}</Text>
            <Text style={styles.line}>Cat ID: {log.catId}</Text>
            <Text style={styles.line}>T0 Image: {log.baselineImg}</Text>
            <Text style={styles.line}>T1 Image: {log.outcomeImg}</Text>
            <Text style={styles.line}>Intake: {log.intakeGram} g</Text>
            <Text style={styles.line}>kcal/g: {log.kcalPerGram.toFixed(2)}</Text>
            <Text style={styles.value}>Daily kcal: {kcal.toFixed(1)}</Text>
          </View>
        );
      })}
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
  value: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: '#1d4ed8',
  },
});

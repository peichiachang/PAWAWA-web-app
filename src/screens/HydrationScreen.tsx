import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FeedingLog } from '../types/domain';
import { calculateActualWaterIntakeMl, calculateTotalWaterIntakeMl } from '../utils/health';

type Props = {
  feedingLogs: FeedingLog[];
};

export function HydrationScreen({ feedingLogs }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>M2 - Hydration</Text>
      {feedingLogs.map((log) => {
        const pureWaterMl = calculateActualWaterIntakeMl(log.waterT0Ml, log.waterT1Ml, log.envFactorMl);
        const totalWaterMl = calculateTotalWaterIntakeMl(pureWaterMl, log.wetFoodAddedWaterMl, log.bowlRatio);
        return (
          <View key={log.sessionId} style={styles.card}>
            <Text style={styles.subtitle}>Session: {log.sessionId}</Text>
            <Text style={styles.line}>
              Water correction: ({log.waterT0Ml} - {log.waterT1Ml}) - {log.envFactorMl} = {pureWaterMl.toFixed(1)} ml
            </Text>
            <Text style={styles.line}>
              Combined hydration: {pureWaterMl.toFixed(1)} + ({log.wetFoodAddedWaterMl} * {log.bowlRatio.toFixed(2)}) =
              {' '}
              {totalWaterMl.toFixed(1)} ml
            </Text>
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
    lineHeight: 20,
  },
});

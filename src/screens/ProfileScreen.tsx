import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CatIdentity } from '../types/domain';

type Props = {
  cats: CatIdentity[];
};

export function ProfileScreen({ cats }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>M0 - Cat Profile & Vitals</Text>
      {cats.map((cat) => (
        <View key={cat.id} style={styles.card}>
          <Text style={styles.name}>{cat.name}</Text>
          <Text style={styles.line}>Gender: {cat.gender}</Text>
          <Text style={styles.line}>Neutered: {cat.spayedNeutered ? 'Yes' : 'No'}</Text>
          <Text style={styles.line}>Weight: {cat.currentWeightKg.toFixed(1)} kg</Text>
          <Text style={styles.line}>Target: {cat.targetWeightKg.toFixed(1)} kg</Text>
          <Text style={styles.line}>BCS: {cat.bcsScore}/9</Text>
          <Text style={styles.line}>Chronic: {cat.chronicConditions.join(', ') || 'None'}</Text>
          <Text style={styles.line}>Allergy blacklist: {cat.allergyBlacklist.join(', ') || 'None'}</Text>
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
  name: {
    fontSize: 18,
    fontWeight: '700',
  },
  line: {
    fontSize: 14,
    color: '#374151',
  },
});

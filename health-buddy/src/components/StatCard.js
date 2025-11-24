// src/components/StatCard.js
import { Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

export default function StatCard({ label, value, sub, right }) {
  return (
    <View style={{
      backgroundColor: colors.card, padding: spacing.md, borderRadius: radius.md,
      borderWidth: 1, borderColor: '#E5E7EB', flex: 1, marginRight: spacing.md
    }}>
      <Text style={{ color: colors.muted, fontSize:12, marginBottom: 6 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize:22, fontWeight:'700' }}>{value}</Text>
      {sub ? <Text style={{ color: colors.muted, marginTop:4 }}>{sub}</Text> : null}
      {right}
    </View>
  );
}

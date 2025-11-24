// src/components/Section.js
import { Text, View } from 'react-native';
import { colors, spacing } from '../theme';

export default function Section({ title, right, children, style }) {
  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: spacing.sm }}>
        <Text style={{ fontSize:18, fontWeight:'600', color: colors.text }}>{title}</Text>
        {right || null}
      </View>
      {children}
    </View>
  );
}

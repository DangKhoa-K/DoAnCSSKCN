import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

function colorByPct(pct) {
  if (pct < 0.5) return '#dc2626';
  if (pct < 0.8) return '#f59e0b';
  return '#16a34a';
}

export function WorkoutCalorieRing({ value = 0, target = 300, size = 140 }) {
  const safeTarget = Number(target) > 0 ? Number(target) : 1;
  const v = Math.max(0, Number(value) || 0);
  const pct = Math.min(1, v / safeTarget);

  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;
  const color = colorByPct(pct);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'relative', width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#E6F0FF" strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke={color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800' }}>{Math.round(v)} kcal</Text>
          <Text style={{ fontSize: 12, color: '#64748B' }}>/{Math.round(safeTarget)} mục tiêu</Text>
          <Text style={{ fontSize: 12, color, marginTop: 4 }}>{Math.round(pct * 100)}%</Text>
        </View>
      </View>
      {pct < 0.5 && (
        <Text style={{ color: '#dc2626', marginTop: 8 }}>
          Mới đạt dưới 50% mục tiêu. Thử thêm 10–15 phút cardio nhẹ.
        </Text>
      )}
    </View>
  );
}
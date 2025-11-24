import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export default function RingProgress({
  size = 120,
  thickness = 12,
  progress = 0,        // 0..1
  color = '#3B82F6',
  bgColor = '#E5E7EB',
  children,
}) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;

  const p = Math.max(0, Math.min(1, Number(progress || 0)));
  const dash = C * p;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* nền */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={bgColor}
          strokeWidth={thickness}
          fill="none"
        />
        {/* vòng tiến độ */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          // 👇 Quan trọng: phải là mảng
          strokeDasharray={[C, C]}
          strokeDashoffset={C - dash}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* nội dung giữa vòng */}
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}

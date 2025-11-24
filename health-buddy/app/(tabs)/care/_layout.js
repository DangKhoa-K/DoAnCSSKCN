// app/(tabs)/care/_layout.js
import { Stack } from 'expo-router';

export default function CareLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: '#2563eb',
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Stack.Screen name="index"     options={{ title: 'Chăm sóc' }} />
      <Stack.Screen name="sleep"     options={{ title: 'Giấc ngủ' }} />
      <Stack.Screen name="meds"      options={{ title: 'Thuốc & nhắc nhở' }} />
      <Stack.Screen name="lifestyle" options={{ title: 'Sinh hoạt' }} />
      <Stack.Screen name="progress"  options={{ title: 'Tiến độ sức khỏe' }} />
    </Stack>
  );
}

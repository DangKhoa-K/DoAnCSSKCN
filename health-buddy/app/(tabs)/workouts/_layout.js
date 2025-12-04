// Stack nội bộ cho tab Tập luyện
import { Stack } from 'expo-router';

export default function WorkoutsLayout() {
  return (
    <Stack screenOptions={{
      headerTintColor: '#0F172A',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: '#F7FAFF' },
      contentStyle: { backgroundColor: '#F7FAFF' },
      headerTitleAlign: 'center' 
    }}>
      <Stack.Screen name="index" options={{ title: 'Tập luyện' }} />
      <Stack.Screen name="plan" options={{ title: 'Kế hoạch & Lịch' }} />
      <Stack.Screen name="library" options={{ title: 'Thư viện bài tập' }} />
      <Stack.Screen name="progress" options={{ title: 'Tiến độ' }} />
    </Stack>
  );
}
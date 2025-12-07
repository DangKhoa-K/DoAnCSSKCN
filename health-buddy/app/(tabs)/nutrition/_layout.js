import { Stack } from 'expo-router';

export default function NutritionLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: '',
        headerTintColor: '#2563eb',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#F6F7FB' },
        headerBackTitle: 'Quay lại',
      }}
    />
  );
}
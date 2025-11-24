import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#6b7280',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Tổng quan',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Tập luyện',
          tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Dinh dưỡng',
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="care"
        options={{
          title: 'Chăm sóc',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />

      {/* Ẩn các route cũ để không hiện tab */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="stats" options={{ href: null }} />
      <Tabs.Screen name="insights" options={{ href: null }} />
    </Tabs>
  );
}

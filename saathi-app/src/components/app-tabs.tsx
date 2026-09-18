import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

export default function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forestInk,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarStyle: {
          backgroundColor: colors.paperCream,
          borderTopColor: colors.borderMist,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* 1. Tijori (Pots / Home) */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tijori',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'wallet' : 'wallet-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 2. Lakshya (Goals) */}
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Lakshya',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'flag' : 'flag-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 3. Khata (Ledger) */}
      <Tabs.Screen
        name="ledger"
        options={{
          title: 'Khata',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 4. Sahayata (Chat / Assistant) */}
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Sahayata',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

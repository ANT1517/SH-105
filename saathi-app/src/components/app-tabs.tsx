import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { colors } from '../theme';

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const isWeb = Platform.OS === 'web';
  const bottomInset = isWeb ? 10 : insets.bottom;

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
          height: 60 + bottomInset,
          paddingBottom: Math.max(bottomInset, 8),
          paddingTop: 8,
          elevation: 4,
          shadowColor: colors.forestInk,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.03,
          shadowRadius: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      {/* 1. Tijori (Pots / Home) */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.tijori'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'wallet' : 'wallet-outline'}
              size={21}
              color={color}
            />
          ),
        }}
      />

      {/* 2. Lakshya (Goals) */}
      <Tabs.Screen
        name="goals"
        options={{
          title: t('tabs.lakshya'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'flag' : 'flag-outline'}
              size={21}
              color={color}
            />
          ),
        }}
      />

      {/* 3. Khata (Ledger) */}
      <Tabs.Screen
        name="ledger"
        options={{
          title: t('tabs.khata'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={21}
              color={color}
            />
          ),
        }}
      />

      {/* Len-Den (all transactions; the Khata tab stays business-only) */}
      <Tabs.Screen
        name="transactions"
        options={{
          title: t('tabs.transactions'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'swap-horizontal' : 'swap-horizontal-outline'}
              size={21}
              color={color}
            />
          ),
        }}
      />

      {/* 4. Sahayata (Chat / Assistant) */}
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.sahayata'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={21}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

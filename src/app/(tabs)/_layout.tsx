import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useI18n } from '@/i18n';
import { colors, fonts } from '@/theme';

export const unstable_settings = { initialRouteName: 'home' };

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.green },
        headerTintColor: colors.white,
        headerTitleStyle: { fontFamily: fonts.semi, color: colors.white },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line, height: 64, paddingBottom: 8, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.semi, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: t('home'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sale"
        options={{
          title: t('bill'),
          tabBarIcon: ({ color, size }) => <Ionicons name="cart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: t('stock'),
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: t('books'),
          tabBarIcon: ({ color, size }) => <Ionicons name="library" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('more'),
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

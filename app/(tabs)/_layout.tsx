import React, { useState, useEffect, useContext } from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { WalletContext } from '../../context/WalletContext';
import { useTheme } from '../../context/theme/ThemeContext';
import { router } from 'expo-router';

export default function TabsLayout() {
  // Get theme colors
  const { colors, isDark } = useTheme();
  
  // Get authentication state from WalletContext
  const walletContext = useContext(WalletContext);
  
  // Check if the user is logged in 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      const authResult = await walletContext?.managers?.walletManager?.isAuthenticated({});
      setIsLoggedIn(authResult?.authenticated || false);
    };
    checkAuth();
  }, [walletContext]);
  
  // If not logged in, redirect to the login screen
  // if (!isLoggedIn) {
  // router.replace('/');
  //   return null;
  // }
  
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          // Set icons for each tab based on route name
          const routeName = route.name.toString();
          
          if (routeName === 'apps') {
            return <MaterialIcons name="apps" size={size} color={color} />;
          } else if (routeName === 'identity') {
            return <FontAwesome5 name="id-card" size={size-2} color={color} />;
          } else if (routeName === 'trust') {
            return <MaterialIcons name="verified-user" size={size} color={color} />;
          } else if (routeName === 'security') {
            return <MaterialIcons name="security" size={size} color={color} />;
          } else if (routeName === 'settings') {
            return <MaterialIcons name="settings" size={size} color={color} />;
          }
          return <MaterialIcons name="circle" size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.inputBorder
        },
        headerStyle: {
          backgroundColor: colors.background
        },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerShown: false
      })}
    >
      <Tabs.Screen name="apps" options={{ title: 'Apps' }} />
      <Tabs.Screen name="identity" options={{ title: 'Identity' }} />
      <Tabs.Screen name="trust" options={{ title: 'Trust' }} />
      <Tabs.Screen name="security" options={{ title: 'Security' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

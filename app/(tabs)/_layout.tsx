import React, { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useContext } from 'react';
import { WalletContext } from '../../context/WalletContext';
import { router } from 'expo-router';

export default function TabsLayout() {
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
  if (!isLoggedIn) {
    router.replace('/');
    return null;
  }
  
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
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
        tabBarActiveTintColor: '#0066cc',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tabs.Screen 
        name="apps" 
        options={{ 
          title: 'Apps',
          headerShown: true 
        }} 
      />
      <Tabs.Screen 
        name="identity" 
        options={{ 
          title: 'Identity', 
          headerShown: true 
        }} 
      />
      <Tabs.Screen 
        name="trust" 
        options={{ 
          title: 'Trust', 
          headerShown: true 
        }} 
      />
      <Tabs.Screen 
        name="security" 
        options={{ 
          title: 'Security', 
          headerShown: true 
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: 'Settings', 
          headerShown: true 
        }} 
      />
    </Tabs>
  );
}

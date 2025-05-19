import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/context/theme/ThemeContext';
import CustomSafeArea from '@/components/CustomSafeArea';
import { RecommendedApps } from '@/components/RecommendedApps';
import Browser from '@/components/Browser';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  }
});

export default function Apps() {
  // Theme integration
  const { colors } = useTheme();
  const [startingUrl, setStartingUrl] = useState<string>('');
  
  return (
    <CustomSafeArea style={[styles.container, { backgroundColor: colors.background }]}> 
      {startingUrl === '' ? <RecommendedApps setStartingUrl={setStartingUrl} /> : <Browser startingUrl={startingUrl} setStartingUrl={setStartingUrl} />}
    </CustomSafeArea>
  );
}
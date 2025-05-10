import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { WalletContext } from '../WalletContext';

// Theme type definitions
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Primary colors
  primary: string;
  secondary: string;
  
  // Backgrounds
  background: string;
  paperBackground: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  
  // Button colors
  buttonBackground: string;
  buttonText: string;
  buttonBackgroundDisabled: string;
  buttonTextDisabled: string;
  
  // Input colors
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  
  // Approval colors
  protocolApproval: string;
  basketApproval: string;
  identityApproval: string;
  renewalApproval: string;
  
  // Status colors
  success: string;
  error: string;
  warning: string;
  info: string;
}

export interface ThemeContextType {
  mode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
  isDark: boolean;
}

// Default theme values
const lightColors: ThemeColors = {
  primary: '#1B365D', // Navy
  secondary: '#2C5282', // Teal
  
  background: '#FFFFFF',
  paperBackground: '#F6F6F6',
  
  textPrimary: '#4A4A4A', // Dark Gray
  textSecondary: '#4A5568', // Gray
  
  buttonBackground: '#1B365D',
  buttonText: '#FFFFFF',
  buttonBackgroundDisabled: 'rgba(0, 0, 0, 0.12)',
  buttonTextDisabled: 'rgba(0, 0, 0, 0.26)',
  
  inputBackground: '#FFFFFF',
  inputBorder: '#DDDDDD',
  inputText: '#4A4A4A',
  
  protocolApproval: '#86c489',
  basketApproval: '#96c486',
  identityApproval: '#86a7c4',
  renewalApproval: '#ad86c4',
  
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
};

const darkColors: ThemeColors = {
  primary: '#FFFFFF',
  secondary: '#487dbf',
  
  background: '#1D2125',
  paperBackground: '#1D2125',
  
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  
  buttonBackground: '#FFFFFF',
  buttonText: '#1B365D',
  buttonBackgroundDisabled: 'rgba(255, 255, 255, 0.12)',
  buttonTextDisabled: 'rgba(255, 255, 255, 0.3)',
  
  inputBackground: '#2A2E32',
  inputBorder: '#444444',
  inputText: '#FFFFFF',
  
  protocolApproval: '#86c489',
  basketApproval: '#96c486',
  identityApproval: '#86a7c4',
  renewalApproval: '#ad86c4',
  
  success: '#66BB6A',
  error: '#EF5350',
  warning: '#FFA726',
  info: '#42A5F5',
};

// Create the context with default values
export const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  setThemeMode: () => {},
  colors: lightColors,
  isDark: false,
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Get system color scheme
  const colorScheme = useColorScheme();
  const { settings } = useContext(WalletContext);
  
  // Initialize theme mode from settings or default to 'system'
  const initialMode = settings?.theme?.mode || 'system';
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialMode as ThemeMode);
  
  // Determine if we should use dark mode
  const shouldUseDarkMode = 
    themeMode === 'dark' || 
    (themeMode === 'system' && colorScheme === 'dark');
  
  // Set the active color scheme based on the mode
  const colors = shouldUseDarkMode ? darkColors : lightColors;
  
  // Update theme mode when settings change
  useEffect(() => {
    if (settings?.theme?.mode) {
      setThemeMode(settings.theme.mode as ThemeMode);
    }
  }, [settings?.theme?.mode]);
  
  return (
    <ThemeContext.Provider value={{
      mode: themeMode,
      setThemeMode,
      colors,
      isDark: shouldUseDarkMode,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

import { StyleSheet } from 'react-native';
import { useTheme } from './ThemeContext';

// This hook creates commonly used styles based on the current theme
export const useThemeStyles = () => {
  const { colors, isDark } = useTheme();
  
  return StyleSheet.create({
    // Container styles
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      backgroundColor: colors.paperBackground,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      padding: 16,
      marginVertical: 8,
    },
    
    // Text styles
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 10,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 30,
      textAlign: 'center',
    },
    text: {
      color: colors.textPrimary,
      fontSize: 16,
    },
    textSecondary: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    
    // Button styles
    button: {
      backgroundColor: colors.buttonBackground,
      paddingVertical: 15,
      paddingHorizontal: 40,
      borderRadius: 10,
      width: '100%',
      alignItems: 'center',
      marginBottom: 20,
    },
    buttonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: 'bold',
    },
    buttonDisabled: {
      backgroundColor: colors.buttonBackgroundDisabled,
    },
    buttonTextDisabled: {
      color: colors.buttonTextDisabled,
    },
    // Secondary button styles (transparent with border)
    buttonSecondary: {
      backgroundColor: 'transparent',
      paddingVertical: 13,
      paddingHorizontal: 38,
      borderRadius: 10,
      width: '100%',
      alignItems: 'center',
      marginBottom: 20,
      borderWidth: 2,
      borderColor: colors.buttonBackground,
    },
    buttonSecondaryText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: 'bold',
    },
    buttonSecondaryDisabled: {
      borderColor: colors.buttonBackgroundDisabled,
    },
    
    // Input styles
    inputContainer: {
      width: '100%',
      marginBottom: 30,
    },
    input: {
      flexDirection: 'row',
      width: '100%',
      height: 50,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      backgroundColor: colors.inputBackground,
      marginBottom: 15,
      alignItems: 'center',
    },
    inputText: {
      flex: 1,
      fontSize: 16,
      paddingHorizontal: 15,
      color: colors.inputText,
    },
    inputLabel: {
      color: colors.textSecondary,
      fontSize: 14,
      marginBottom: 5,
    },
    
    // Icon styles
    icon: {
      padding: 10,
      color: colors.textSecondary,
    },
    
    // Validation styles
    validationError: {
      color: colors.error,
      fontSize: 12,
      marginBottom: 15,
      marginTop: -10,
    },
    
    // Link styles
    link: {
      color: colors.secondary,
      fontWeight: '500',
    },
    
    // Other common styles
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      width: '100%',
      marginVertical: 16,
    },
  });
};

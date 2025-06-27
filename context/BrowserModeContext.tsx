import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useLocalStorage } from './LocalStorageProvider';

interface BrowserModeContextType {
  isWeb2Mode: boolean;
  setWeb2Mode: (enabled: boolean) => void;
  toggleMode: () => void;
  showWeb3Benefits: (onContinue: () => void, onGoToLogin: () => void) => void;
  hideWeb3Benefits: () => void;
  web3BenefitsVisible: boolean;
  web3BenefitsCallbacks: {
    onContinue: (() => void) | null;
    onGoToLogin: (() => void) | null;
  };
}

const BrowserModeContext = createContext<BrowserModeContextType>({
  isWeb2Mode: false,
  setWeb2Mode: () => {},
  toggleMode: () => {},
  showWeb3Benefits: () => {},
  hideWeb3Benefits: () => {},
  web3BenefitsVisible: false,
  web3BenefitsCallbacks: {
    onContinue: null,
    onGoToLogin: null,
  },
});

export const useBrowserMode = () => {
  const context = useContext(BrowserModeContext);
  if (!context) {
    throw new Error('useBrowserMode must be used within a BrowserModeProvider');
  }
  return context;
};

interface BrowserModeProviderProps {
  children: React.ReactNode;
}

export const BrowserModeProvider: React.FC<BrowserModeProviderProps> = ({ children }) => {
  const [isWeb2Mode, setIsWeb2Mode] = useState(false);
  const [web3BenefitsVisible, setWeb3BenefitsVisible] = useState(false);
  const [web3BenefitsCallbacks, setWeb3BenefitsCallbacks] = useState<{
    onContinue: (() => void) | null;
    onGoToLogin: (() => void) | null;
  }>({
    onContinue: null,
    onGoToLogin: null,
  });
  const { getItem, setItem } = useLocalStorage();
  const params = useLocalSearchParams();

  // Initialize mode from URL params or stored preference
  useEffect(() => {
    const initializeMode = async () => {
      // Check if mode is specified in URL params
      if (params.mode === 'web2') {
        setIsWeb2Mode(true);
        // Store this preference
        await setItem('browserMode', 'web2');
      } else if (params.mode === 'web3') {
        setIsWeb2Mode(false);
        await setItem('browserMode', 'web3');
      } else {
        // Load from stored preference
        try {
          const storedMode = await getItem('browserMode');
          setIsWeb2Mode(storedMode === 'web2');
        } catch (error) {
          console.log('No stored browser mode, defaulting to web3');
          setIsWeb2Mode(false);
        }
      }
    };

    initializeMode();
  }, [params.mode, getItem, setItem]);

  const setWeb2Mode = async (enabled: boolean) => {
    setIsWeb2Mode(enabled);
    await setItem('browserMode', enabled ? 'web2' : 'web3');
  };

  const toggleMode = async () => {
    const newMode = !isWeb2Mode;
    setIsWeb2Mode(newMode);
    await setItem('browserMode', newMode ? 'web2' : 'web3');
  };

  const showWeb3Benefits = (onContinue: () => void, onGoToLogin: () => void) => {
    setWeb3BenefitsCallbacks({ onContinue, onGoToLogin });
    setWeb3BenefitsVisible(true);
  };

  const hideWeb3Benefits = () => {
    setWeb3BenefitsVisible(false);
    setWeb3BenefitsCallbacks({ onContinue: null, onGoToLogin: null });
  };

  const value = {
    isWeb2Mode,
    setWeb2Mode,
    toggleMode,
    showWeb3Benefits,
    hideWeb3Benefits,
    web3BenefitsVisible,
    web3BenefitsCallbacks,
  };

  return (
    <BrowserModeContext.Provider value={value}>
      {children}
    </BrowserModeContext.Provider>
  );
};

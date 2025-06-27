import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useLocalStorage } from './LocalStorageProvider';
import { useWallet } from './WalletContext';

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
  const [manualMode, setManualMode] = useState<'web2' | 'web3' | null>(null); // Manual override
  const [web3BenefitsVisible, setWeb3BenefitsVisible] = useState(false);
  const [web3BenefitsCallbacks, setWeb3BenefitsCallbacks] = useState<{
    onContinue: (() => void) | null;
    onGoToLogin: (() => void) | null;
  }>({
    onContinue: null,
    onGoToLogin: null,
  });
  const { getItem, setItem } = useLocalStorage();
  const { managers } = useWallet();
  const params = useLocalSearchParams();

  // Auto-detect Web2 mode based on wallet authentication
  const isWeb2Mode = manualMode === 'web2' || (!manualMode && !managers?.walletManager?.authenticated);

  // Initialize mode from URL params or stored preference
  useEffect(() => {
    const initializeMode = async () => {
      // Check if mode is specified in URL params
      if (params.mode === 'web2') {
        setManualMode('web2');
        // Store this preference
        await setItem('browserMode', 'web2');
      } else if (params.mode === 'web3') {
        setManualMode('web3');
        await setItem('browserMode', 'web3');
      } else {
        // Load from stored preference
        try {
          const storedMode = await getItem('browserMode');
          if (storedMode === 'web2' || storedMode === 'web3') {
            setManualMode(storedMode);
          } else {
            // No manual override stored, let auto-detection handle it
            setManualMode(null);
          }
        } catch (error) {
          console.log('No stored browser mode, using auto-detection');
          setManualMode(null);
        }
      }
    };

    initializeMode();
  }, [params.mode, getItem, setItem]);

  const setWeb2Mode = async (enabled: boolean) => {
    const newMode = enabled ? 'web2' : 'web3';
    setManualMode(newMode);
    await setItem('browserMode', newMode);
  };

  const toggleMode = async () => {
    const newMode = isWeb2Mode ? 'web3' : 'web2';
    setManualMode(newMode);
    await setItem('browserMode', newMode);
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

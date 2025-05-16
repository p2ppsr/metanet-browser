import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, TouchableOpacity, View, SafeAreaView } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/context/theme/ThemeContext';
import { useThemeStyles } from '@/context/theme/useThemeStyles';
import { useWallet } from '@/context/WalletContext';
import { WalletInterface } from '@bsv/sdk';
import CustomSafeArea from '@/components/CustomSafeArea';

const DEFAULT_URL = 'https://deggen.ngrok.app';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleContainer: {
    height: 50
  },
  urlBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginHorizontal: 10,
    marginBottom: 10,
  },
  urlInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  navButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  navButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  disabledButton: {
    backgroundColor: '#eee',
    opacity: 0.5,
  },
  goButton: {
    height: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  goButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingBar: {
    height: 3,
    backgroundColor: '#eee',
    width: '100%',
  },
  loadingIndicator: {
    height: '100%',
    width: '20%',
    backgroundColor: '#4285F4',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  messageContainer: {
    padding: 10,
    backgroundColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 12,
  }
});

export default function Browser() {
  // Theme integration
  const { colors, isDark } = useTheme();
  const themeStyles = useThemeStyles();
  const [wallet, setWallet] = useState<WalletInterface | undefined>(undefined);
  const { managers } = useWallet();

  useEffect(() => {
    if (managers?.walletManager?.authenticated) {
      console.log('setting wallet')
      setWallet(managers?.walletManager)
    }
  }, [managers])

  const webviewRef = useRef<WebView>(null);
  
  // URL and navigation state
  const [url, setUrl] = useState<string>(DEFAULT_URL);
  const [currentUrl, setCurrentUrl] = useState<string>(DEFAULT_URL);
  const [inputUrl, setInputUrl] = useState<string>(DEFAULT_URL);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Initialize XDM with the native app URL as the origin
  // const xdm = useRef(new XDM('bsv-wallet://app'));

  // State to track console logs from WebView
  const [consoleLogs, setConsoleLogs] = useState<Array<{method: string, args: string[], timestamp: number}>>([]);

  // Handle WebView messages
  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    let msg
    try {
      msg = JSON.parse(event.nativeEvent.data);
      
      // Handle console logs from the WebView
      if (msg.type === 'CONSOLE') {
        const newLog = {
          method: msg.method,
          args: msg.args,
          timestamp: Date.now()
        };
        
        // Log to React Native console with appropriate method
        switch (msg.method) {
          case 'log':
            console.log('[WebView]', ...msg.args);
            break;
          case 'warn':
            console.warn('[WebView]', ...msg.args);
            break;
          case 'error':
            console.error('[WebView]', ...msg.args);
            break;
          case 'info':
            console.info('[WebView]', ...msg.args);
            break;
          case 'debug':
            console.debug('[WebView]', ...msg.args);
            break;
        }
        
        // Keep the last 50 logs
        setConsoleLogs(prevLogs => [
          newLog,
          ...prevLogs.slice(0, 49)
        ]);
        
        return;
      }
      
      // Handle API calls
      const origin = currentUrl.split('/')[2];
      console.log(msg.call, msg.args, origin);


      let response: any;
      switch(msg.call) {
        case 'getPublicKey':
          response = await wallet?.getPublicKey(msg?.args || {}, origin)
          break;
        case 'revealCounterpartyKeyLinkage':
          response = await wallet?.revealCounterpartyKeyLinkage(msg?.args || {}, origin)
          break;
        case 'revealSpecificKeyLinkage':
          response = await wallet?.revealSpecificKeyLinkage(msg?.args || {}, origin)
          break;
        case 'encrypt':
          response = await wallet?.encrypt(msg?.args || {}, origin)
          break;
        case 'decrypt':
          response = await wallet?.decrypt(msg?.args || {}, origin)
          break;
        case 'createHmac':
          response = await wallet?.createHmac(msg?.args || {}, origin)
          break;
        case 'verifyHmac':
          response = await wallet?.verifyHmac(msg?.args || {}, origin)
          break;
        case 'createSignature':
          response = await wallet?.createSignature(msg?.args || {}, origin)
          break;
        case 'verifySignature':
          response = await wallet?.verifySignature(msg?.args || {}, origin)
          break;
        case 'createAction':
          response = await wallet?.createAction(msg?.args || {}, origin)
          break;
        case 'signAction':
          response = await wallet?.signAction(msg?.args || {}, origin)
          break;
        case 'abortAction':
          response = await wallet?.abortAction(msg?.args || {}, origin)
          break;
        case 'listActions':
          response = await wallet?.listActions(msg?.args || {}, origin)
          break;
        case 'internalizeAction':
          response = await wallet?.internalizeAction(msg?.args || {}, origin)
          break;
        case 'listOutputs':
          response = await wallet?.listOutputs(msg?.args || {}, origin)
          break;
        case 'relinquishOutput':
          response = await wallet?.relinquishOutput(msg?.args || {}, origin)
          break;
        case 'acquireCertificate':
          response = await wallet?.acquireCertificate(msg?.args || {}, origin)
          break;
        case 'listCertificates':
          response = await wallet?.listCertificates(msg?.args || {}, origin)
          break;
        case 'proveCertificate':
          response = await wallet?.proveCertificate(msg?.args || {}, origin)
          break;
        case 'relinquishCertificate':
          response = await wallet?.relinquishCertificate(msg?.args || {}, origin)
          break;
        case 'discoverByIdentityKey':
          response = await wallet?.discoverByIdentityKey(msg?.args || {}, origin)
          break;
        case 'isAuthenticated':
          response = await wallet?.isAuthenticated({}, origin)
          break;
        case 'waitForAuthentication':
          response = await wallet?.waitForAuthentication({}, origin)
          break;
        case 'getHeight':
          response = await wallet?.getHeight({}, origin)
          break;
        case 'getHeaderForHeight':
          response = await wallet?.getHeaderForHeight(msg?.args || {}, origin)
          break;
        case 'discoverByAttributes':
          response = await wallet?.discoverByAttributes(msg?.args || {}, origin)
          break;
        case 'getNetwork':
          response = await wallet?.getNetwork({}, origin)
          break;
        case 'getVersion':
        default:
          response = await wallet?.getVersion({}, origin)
          break;
      }
      sendResponseToWebView(msg.id, response)
    } catch (error) {
      console.error('Error handling WebView message:', error, msg);
    }
  }, [wallet]);

  // Send a message to the WebView
  const sendResponseToWebView = (id: string, result: any) => {
    try {
      console.log("sending... ", id, result);
      if (!webviewRef.current) return;
      console.log("webviewRef.current");
      
      // Create a message in the format expected by XDM
      const message = {
        type: 'CWI',
        id,
        isInvocation: false,
        result,
        status: 'ok'
      };
      
      // Send the message to the WebView using injectJavaScript
      function getInjectableJSMessage(message: any = {}) {
        const messageString = JSON.stringify(message)
        return `
          (function() {
            window.dispatchEvent(new MessageEvent('message', {
              data: JSON.stringify(${messageString})
            }));
          })();
        `;
      }
      webviewRef.current?.injectJavaScript(
        getInjectableJSMessage(message)
      );
      console.info({ message });
    } catch (error) {
      console.error('Error sending message to WebView:', error);
    }
  };

  // JavaScript to inject into the WebView to capture console logs
  const injectedJavaScript = `
    (function() {
      if (window.isLogListenerInjected) return;
      window.isLogListenerInjected = true;
      
      // Create a logs container div that will be attached to the bottom of the page
      const logsContainer = document.createElement('div');
      logsContainer.id = 'console-logs-container';
      logsContainer.style.cssText = 'position: fixed; bottom: 0; left: 0; right: 0; max-height: 30vh; background-color: rgba(0, 0, 0, 0.8); color: white; font-family: monospace; font-size: 12px; padding: 8px; overflow-y: auto; z-index: 9999; border-top: 1px solid #444;';
      
      // Function to add a log entry to the container
      function addLogToContainer(method, args) {
        const logEntry = document.createElement('div');
        logEntry.style.cssText = 'margin: 2px 0; border-bottom: 1px solid #333; padding-bottom: 2px;';
        
        // Add different styling based on log method
        switch(method) {
          case 'error':
            logEntry.style.color = '#ff5252';
            break;
          case 'warn':
            logEntry.style.color = '#ffab40';
            break;
          case 'info':
            logEntry.style.color = '#2196f3';
            break;
          case 'debug':
            logEntry.style.color = '#69f0ae';
            break;
          default:
            logEntry.style.color = 'white';
        }
        
        // Create timestamp
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const logContent = Array.from(args).map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        logEntry.textContent = \`[\${timestamp}] [\${method.toUpperCase()}]: \${logContent}\`;
        logsContainer.appendChild(logEntry);
        
        // Auto-scroll to the bottom
        logsContainer.scrollTop = logsContainer.scrollHeight;
        
        // Limit the number of log entries to prevent memory issues
        while (logsContainer.children.length > 100) {
          logsContainer.removeChild(logsContainer.firstChild);
        }
      }
      
      // Add the logs container to the DOM when the page is loaded
      if (document.body) {
        document.body.appendChild(logsContainer);
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          document.body.appendChild(logsContainer);
        });
      }
      
      // Store original console methods
      const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info,
        debug: console.debug
      };
      
      // Override console methods to display logs in the container
      console.log = function() {
        originalConsole.log.apply(console, arguments);
        addLogToContainer('log', arguments);
      };
      
      console.warn = function() {
        originalConsole.warn.apply(console, arguments);
        addLogToContainer('warn', arguments);
      };
      
      console.error = function() {
        originalConsole.error.apply(console, arguments);
        addLogToContainer('error', arguments);
      };
      
      console.info = function() {
        originalConsole.info.apply(console, arguments);
        addLogToContainer('info', arguments);
      };
      
      console.debug = function() {
        originalConsole.debug.apply(console, arguments);
        addLogToContainer('debug', arguments);
      };
      
      // Also capture uncaught errors
      window.addEventListener('error', function(e) {
        addLogToContainer('error', ['Uncaught error:', e.message, 'at', e.filename, 'line', e.lineno]);
        return true;
      });
      
      // Create a button to toggle the visibility of the logs container
      const toggleButton = document.createElement('button');
      toggleButton.textContent = 'Toggle Logs';
      toggleButton.style.cssText = 'position: fixed; bottom: 0; right: 0; background-color: #444; color: white; border: none; border-radius: 4px 0 0 0; padding: 4px 8px; font-size: 10px; z-index: 10000; cursor: pointer;';
      toggleButton.addEventListener('click', function() {
        if (logsContainer.style.display === 'none') {
          logsContainer.style.display = 'block';
          toggleButton.textContent = 'Hide Logs';
        } else {
          logsContainer.style.display = 'none';
          toggleButton.textContent = 'Show Logs';
        }
      });
      
      // Add the toggle button to the DOM
      if (document.body) {
        document.body.appendChild(toggleButton);
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          document.body.appendChild(toggleButton);
        });
      }
      
      true; // Note: this is needed to ensure the script is correctly injected
    })();
  `;

  // Handle URL submission
  const handleUrlSubmit = () => {
    let formattedUrl = inputUrl;
    
    // Add http:// if no protocol specified
    if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://')) {
      formattedUrl = 'https://' + inputUrl;
      setInputUrl(formattedUrl);
    }
    
    setUrl(formattedUrl);
  };
  
  // Handle navigation state change
  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
    setCurrentUrl(navState.url);
    setInputUrl(navState.url);
    setIsLoading(navState.loading);
  };
  
  return (
    <CustomSafeArea style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />      
      {/* URL input and navigation controls */}
      <View style={[styles.urlBarContainer, { backgroundColor: colors.inputBackground }]}>
        <TouchableOpacity 
          style={[
            styles.navButton, 
            { backgroundColor: colors.secondary },
            !canGoBack && [styles.disabledButton, { backgroundColor: colors.inputBorder }]
          ]}
          onPress={() => webviewRef.current?.goBack()}
          disabled={!canGoBack}
        >
          <Text style={[styles.navButtonText, { color: colors.buttonText }]}>←</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.navButton, 
            { backgroundColor: colors.secondary },
            !canGoForward && [styles.disabledButton, { backgroundColor: colors.inputBorder }]
          ]}
          onPress={() => webviewRef.current?.goForward()}
          disabled={!canGoForward}
        >
          <Text style={[styles.navButtonText, { color: colors.buttonText }]}>→</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.navButton, { backgroundColor: colors.secondary }]}
          onPress={() => webviewRef.current?.reload()}
        >
          <Text style={[styles.navButtonText, { color: colors.buttonText }]}>↻</Text>
        </TouchableOpacity>
        
        <TextInput
          style={[
            styles.urlInput,
            { 
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
              color: colors.textPrimary 
            }
          ]}
          value={inputUrl}
          onChangeText={setInputUrl}
          onSubmitEditing={handleUrlSubmit}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          selectTextOnFocus
          placeholderTextColor={colors.textSecondary}
        />
        
        <TouchableOpacity 
          style={[styles.goButton, { backgroundColor: colors.primary }]}
          onPress={handleUrlSubmit}
        >
          <Text style={[styles.goButtonText, { color: colors.buttonText }]}>Go</Text>
        </TouchableOpacity>
      </View>
      
      {/* Loading indicator */}
      <View style={[styles.loadingBar, { backgroundColor: isDark ? '#333' : '#eee' }]}>
        {isLoading && <View style={[styles.loadingIndicator, { backgroundColor: colors.primary }]} />}
      </View>
      
      <WebView
        ref={webviewRef}
        source={{ uri: url }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        containerStyle={{ backgroundColor: colors.background }}
        injectedJavaScript={injectedJavaScript}
      />

    </CustomSafeArea>
  );
}
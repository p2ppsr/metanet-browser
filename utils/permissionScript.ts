import { PermissionType } from './permissionsManager'

/**
 * Generates the JavaScript code to be injected into WebView for permission handling
 * @param deniedPermissions List of permissions denied for the current domain
 * @param pendingPermission Currently pending permission (if any)
 * @returns JavaScript code string to be injected
 */
export const getPermissionScript = (
  deniedPermissions: PermissionType[],
  pendingPermission: PermissionType | null
): string => {
  return `
(function() {
  // List of permissions denied for this domain
  const denied = ${JSON.stringify(deniedPermissions)};
  const pending = ${JSON.stringify(pendingPermission)};
  
  window.__metanetDeniedPermissions = denied;
  window.__metanetPendingPermissions = pending;
  console.log('[Metanet] Initializing permission hooks with denied:', denied, 'pending:', pending);

  // Push Notification API polyfill - MUST run before page content loads
  (function() {
    // Always override Notification API to ensure it works with React Native
    console.log('[RN WebView] Initializing Notification API polyfill before content load');
    
    // Store original if it exists
    const originalNotification = window.Notification;
    
    // Polyfill Notification constructor
    window.Notification = function(title, options = {}) {
      this.title = title;
      this.body = options.body || '';
      this.icon = options.icon || '';
      this.tag = options.tag || '';
      this.data = options.data || null;
      
      // Send notification to native
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'SHOW_NOTIFICATION',
        title: this.title,
        body: this.body,
        icon: this.icon,
        tag: this.tag,
        data: this.data
      }));
      
      return this;
    };

    // Static methods
    window.Notification.requestPermission = function(callback) {
      return new Promise((resolve) => {
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'REQUEST_NOTIFICATION_PERMISSION',
          callback: true
        }));
        
        // Listen for response
        const handler = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'NOTIFICATION_PERMISSION_RESPONSE') {
              window.removeEventListener('message', handler);
              const permission = data.permission;
              
              // CRITICAL: Properly update the permission property so websites can read it
              Object.defineProperty(window.Notification, 'permission', {
                value: permission,
                writable: false,
                configurable: true,
                enumerable: true
              });
              
              console.log('[RN WebView] Permission updated to:', window.Notification.permission);
              console.log('[RN WebView] Permission check:', window.Notification.permission === 'granted');
              
              if (callback) callback(permission);
              resolve(permission);
            }
          } catch (e) {}
        };
        window.addEventListener('message', handler);
      });
    };

    // Set initial permission status
    window.Notification.permission = 'default';
    
    // Add permission constants
    window.Notification.PERMISSION_GRANTED = 'granted';
    window.Notification.PERMISSION_DENIED = 'denied';
    window.Notification.PERMISSION_DEFAULT = 'default';
    
    console.log('[RN WebView] Notification API polyfill initialized before content, permission:', window.Notification.permission);

    // Add PushManager constructor and static properties for better compatibility
    if (!window.PushManager) {
      window.PushManager = function() {};
      window.PushManager.supportedContentEncodings = ['aes128gcm', 'aesgcm'];
      console.log('[RN WebView] PushManager constructor added');
    }

    // Add comprehensive debugging for push subscription attempts
    console.log('[RN WebView] 🔍 Checking existing APIs:');
    console.log('[RN WebView] - navigator.serviceWorker:', !!navigator.serviceWorker);
    console.log('[RN WebView] - PushManager:', !!window.PushManager);
    console.log('[RN WebView] - Notification:', !!window.Notification);
    
    // Enhanced ServiceWorker registration polyfill for push notifications
    if (!('serviceWorker' in navigator)) {
      console.log('[RN WebView] Creating comprehensive ServiceWorker polyfill');
      
      // Create a more realistic ServiceWorker implementation
      const ServiceWorkerContainer = function() {};
      ServiceWorkerContainer.prototype = {
        register: function(scriptURL, options) {
          console.log('[RN WebView] ServiceWorker register called with:', scriptURL, options);
          
          // Create a comprehensive mock service worker registration
          const registration = {
            scope: options?.scope || '/',
            active: {
              scriptURL: scriptURL,
              state: 'activated',
              postMessage: function() {},
              addEventListener: function() {},
              removeEventListener: function() {}
            },
            installing: null,
            waiting: null,
            unregister: function() {
              return Promise.resolve(true);
            },
            update: function() {
              return Promise.resolve(this);
            },
            addEventListener: function() {},
            removeEventListener: function() {},
            pushManager: {
              subscribe: function(options) {
                console.log('[RN WebView] 🚀 PushManager subscribe called with:', options);
                console.log('[RN WebView] 🔑 VAPID public key:', options?.applicationServerKey);
                console.log('[RN WebView] 👁️ User visible only:', options?.userVisibleOnly);
                console.log('[RN WebView] 📱 ReactNativeWebView available:', !!window.ReactNativeWebView);
                
                // Add comprehensive error handling
                try {
                  console.log('[RN WebView] 📤 Sending PUSH_SUBSCRIBE message');
                  
                  return new Promise((resolve, reject) => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'PUSH_SUBSCRIBE',
                    options: options
                  }));
                  
                  const handler = (event) => {
                    try {
                      const data = JSON.parse(event.data);
                      if (data.type === 'PUSH_SUBSCRIPTION_RESPONSE') {
                        window.removeEventListener('message', handler);
                        console.log('[RN WebView] Received subscription response:', data.subscription);
                        
                        if (data.subscription) {
                          console.log('[RN WebView] Subscription endpoint:', data.subscription.endpoint);
                          console.log('[RN WebView] Subscription keys:', data.subscription.keys);
                          console.log('[RN WebView] Subscription toJSON:', typeof data.subscription.toJSON);
                          
                          // Test the subscription object
                          try {
                            const jsonTest = JSON.stringify(data.subscription);
                            console.log('[RN WebView] Subscription JSON test passed:', jsonTest.length, 'chars');
                          } catch (jsonError) {
                            console.error('[RN WebView] Subscription JSON test failed:', jsonError);
                          }
                          
                          resolve(data.subscription);
                        } else {
                          console.error('[RN WebView] No subscription in response');
                          reject(new Error('Failed to create push subscription'));
                        }
                      }
                    } catch (e) {
                      console.error('[RN WebView] Error parsing subscription response:', e);
                      reject(e);
                    }
                  };
                  window.addEventListener('message', handler);
                  
                    // Add timeout to prevent hanging
                    setTimeout(() => {
                      window.removeEventListener('message', handler);
                      console.error('[RN WebView] ⏰ Push subscription timeout after 10 seconds');
                      reject(new Error('Push subscription timeout'));
                    }, 10000);
                  });
                } catch (error) {
                  console.error('[RN WebView] ❌ Error in subscribe function:', error);
                  return Promise.reject(error);
                }
              },
              getSubscription: function() {
                console.log('[RN WebView] PushManager getSubscription called');
                return new Promise((resolve, reject) => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'GET_PUSH_SUBSCRIPTION'
                  }));
                  
                  const handler = (event) => {
                    try {
                      const data = JSON.parse(event.data);
                      if (data.type === 'PUSH_SUBSCRIPTION_RESPONSE') {
                        window.removeEventListener('message', handler);
                        console.log('[RN WebView] Received existing subscription:', data.subscription);
                        resolve(data.subscription);
                      }
                    } catch (e) {
                      console.error('[RN WebView] Error parsing subscription response:', e);
                      reject(e);
                    }
                  };
                  window.addEventListener('message', handler);
                  
                  // Add timeout
                  setTimeout(() => {
                    window.removeEventListener('message', handler);
                    resolve(null); // Return null for no existing subscription
                  }, 5000);
                });
              },
              permissionState: function() {
                return Promise.resolve(window.Notification.permission || 'default');
              },
              // Add missing properties that websites check for
              supportedContentEncodings: ['aes128gcm', 'aesgcm'],
              // Add VAPID support indication
              vapidPublicKey: null
            },
            addEventListener: function() {},
            removeEventListener: function() {},
            update: function() { return Promise.resolve(); },
            unregister: function() { return Promise.resolve(true); }
          };
          
          console.log('[RN WebView] ServiceWorker registration created:', registration);
          return Promise.resolve(registration);
        },
        ready: Promise.resolve({
          active: { state: 'activated' },
          pushManager: {
            subscribe: function(options) {
              console.log('[RN WebView] 🚀 Ready pushManager subscribe called with:', options);
              return navigator.serviceWorker.register().then(reg => reg.pushManager.subscribe(options));
            },
            getSubscription: function() {
              console.log('[RN WebView] 🔍 Ready pushManager getSubscription called');
              return navigator.serviceWorker.register().then(reg => reg.pushManager.getSubscription());
            },
            permissionState: function() {
              console.log('[RN WebView] 🔑 Ready pushManager permissionState called');
              return Promise.resolve(window.Notification.permission || 'default');
            }
          }
        }),
        getRegistration: function() {
          return navigator.serviceWorker.register();
        },
        getRegistrations: function() {
          return navigator.serviceWorker.register().then(reg => [reg]);
        }
      };
      
      console.log('[RN WebView] ServiceWorker polyfill initialized');
    } else {
      console.log('[RN WebView] ServiceWorker already exists, enhancing pushManager');
      // If service worker exists but might not have proper push support, enhance it
      const originalRegister = navigator.serviceWorker.register;
      navigator.serviceWorker.register = function(scriptURL, options) {
        return originalRegister.call(this, scriptURL, options).then(registration => {
          // Enhance the registration with our push manager if needed
          if (!registration.pushManager || !registration.pushManager.subscribe) {
            registration.pushManager = {
              subscribe: function(options) {
                console.log('[RN WebView] Enhanced PushManager subscribe called');
                return new Promise((resolve, reject) => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'PUSH_SUBSCRIBE',
                    options: options
                  }));
                  
                  const handler = (event) => {
                    try {
                      const data = JSON.parse(event.data);
                      if (data.type === 'PUSH_SUBSCRIPTION_RESPONSE') {
                        window.removeEventListener('message', handler);
                        if (data.subscription) {
                          resolve(data.subscription);
                        } else {
                          reject(new Error('Failed to create push subscription'));
                        }
                      }
                    } catch (e) {
                      reject(e);
                    }
                  };
                  window.addEventListener('message', handler);
                  
                  setTimeout(() => {
                    window.removeEventListener('message', handler);
                    reject(new Error('Push subscription timeout'));
                  }, 10000);
                });
              },
              getSubscription: function() {
                return new Promise((resolve) => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'GET_PUSH_SUBSCRIPTION'
                  }));
                  
                  const handler = (event) => {
                    try {
                      const data = JSON.parse(event.data);
                      if (data.type === 'PUSH_SUBSCRIPTION_RESPONSE') {
                        window.removeEventListener('message', handler);
                        resolve(data.subscription);
                      }
                    } catch (e) {
                      resolve(null);
                    }
                  };
                  window.addEventListener('message', handler);
                  
                  setTimeout(() => {
                    window.removeEventListener('message', handler);
                    resolve(null);
                  }, 5000);
                });
              },
              permissionState: function() {
                return Promise.resolve(window.Notification.permission || 'default');
              }
            };
          }
          return registration;
        });
      };
    }
    
    // Add comprehensive debugging and interception for push subscriptions
    console.log('[RN WebView] 🔍 Setting up comprehensive push debugging...');
    
    // Intercept navigator.serviceWorker.ready access
    if (navigator.serviceWorker) {
      const originalReady = navigator.serviceWorker.ready;
      Object.defineProperty(navigator.serviceWorker, 'ready', {
        get: function() {
          console.log('[RN WebView] 🚀 navigator.serviceWorker.ready accessed!');
          return Promise.resolve({
            scope: '/',
            active: {
              scriptURL: '/sw.js',
              state: 'activated',
              postMessage: function() {},
              addEventListener: function() {},
              removeEventListener: function() {}
            },
            installing: null,
            waiting: null,
            unregister: function() {
              return Promise.resolve(true);
            },
            update: function() {
              return Promise.resolve(this);
            },
            addEventListener: function() {},
            removeEventListener: function() {},
            pushManager: {
              subscribe: function(options) {
                console.log('[RN WebView] 🚀 READY.pushManager.subscribe called with:', options);
                console.log('[RN WebView] 📤 READY Sending PUSH_SUBSCRIBE message');
                
                return new Promise((resolve, reject) => {
                  window.ReactNativeWebView?.postMessage(JSON.stringify({
                    type: 'PUSH_SUBSCRIBE',
                    options: options
                  }));
                  
                  const handler = (event) => {
                    try {
                      const data = JSON.parse(event.data);
                      if (data.type === 'PUSH_SUBSCRIPTION_RESPONSE') {
                        window.removeEventListener('message', handler);
                        console.log('[RN WebView] READY Received subscription response:', data.subscription);
                        if (data.subscription) {
                          resolve(data.subscription);
                        } else {
                          reject(new Error('Failed to create push subscription'));
                        }
                      }
                    } catch (e) {
                      console.error('[RN WebView] READY Error parsing subscription response:', e);
                      reject(e);
                    }
                  };
                  window.addEventListener('message', handler);
                  
                  setTimeout(() => {
                    window.removeEventListener('message', handler);
                    console.error('[RN WebView] ⏰ READY Push subscription timeout');
                    reject(new Error('Push subscription timeout'));
                  }, 10000);
                });
              },
              getSubscription: function() {
                console.log('[RN WebView] READY.pushManager.getSubscription called');
                return Promise.resolve(null);
              },
              permissionState: function() {
                console.log('[RN WebView] READY.pushManager.permissionState called');
                return Promise.resolve(window.Notification.permission || 'default');
              }
            }
          });
        },
        configurable: true
      });
    }
    
    // Add global debugging for any push-related function calls
    const originalConsoleLog = console.log;
    window.addEventListener('click', function(event) {
      console.log('[RN WebView] 🖱️ Click detected on:', event.target?.tagName, event.target?.textContent?.substring(0, 50));
    });
    
    console.log('[RN WebView] ✅ Comprehensive push debugging setup complete');
  })();

  // Handle camera and microphone access
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.__originalGetUserMedia = originalGetUserMedia;  // save original

    navigator.mediaDevices.getUserMedia = function(constraints) {
      const deniedList = window.__metanetDeniedPermissions || [];
      const pendingList = window.__metanetPendingPermissions || [];

      if (constraints.video && deniedList.includes("CAMERA")) {
        console.log('[Metanet] Camera access denied by site settings');
        return Promise.reject(new DOMException("Camera access denied by site settings", "NotAllowedError"));
      }
      if (constraints.audio && deniedList.includes("RECORD_AUDIO")) {
        console.log('[Metanet] Microphone access denied by site settings');
        return Promise.reject(new DOMException("Microphone access denied by site settings", "NotAllowedError"));
      }

      const camPending = constraints.video && pendingList.includes("CAMERA");
      const micPending = constraints.audio && pendingList.includes("RECORD_AUDIO");
      if (camPending || micPending) {
        console.log('[Metanet] Media permission request pending user decision, delaying response');
        return new Promise((resolve, reject) => {
          const checkInterval = setInterval(() => {
            const stillPending = (constraints.video && window.__metanetPendingPermissions.includes("CAMERA")) 
                              || (constraints.audio && window.__metanetPendingPermissions.includes("RECORD_AUDIO"));
            if (!stillPending) {
              clearInterval(checkInterval);
              clearTimeout(timeoutId);
              console.log('[Metanet] User decided on media permission, continuing request');
              // After decision, check if denied or allowed:
              const cameraNowDenied = constraints.video && window.__metanetDeniedPermissions.includes("CAMERA");
              const micNowDenied    = constraints.audio && window.__metanetDeniedPermissions.includes("RECORD_AUDIO");
              if (cameraNowDenied || micNowDenied) {
                console.log('[Metanet] User denied permission, rejecting request');
                reject(new DOMException("Media access denied by user", "NotAllowedError"));
              } else {
                console.log('[Metanet] User allowed permission, proceeding with request');
                // User allowed - call the original getUserMedia to get the stream
                originalGetUserMedia(constraints).then(resolve).catch(reject);
              }
            }
          }, 100);
          // Safety: if user never responds, time out after 60s
          const timeoutId = setTimeout(() => {
            clearInterval(checkInterval);
            console.warn('[Metanet] Permission request timed out');
            reject(new DOMException("Permission request timed out", "NotAllowedError"));
          }, 60000);
        });
      }

      // Mark as pending and ask React Native to show a prompt:
      if (constraints.video && !deniedList.includes("CAMERA") && !pendingList.includes("CAMERA")) {
        window.__metanetPendingPermissions.push("CAMERA");
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'REQUEST_CAMERA' }));
      }
      if (constraints.audio && !deniedList.includes("RECORD_AUDIO") && !pendingList.includes("RECORD_AUDIO")) {
        window.__metanetPendingPermissions.push("RECORD_AUDIO");
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'REQUEST_MICROPHONE' }));
      }
      console.log('[Metanet] Media permission requested, waiting for user decision...');
      // Return a Promise that will be resolved/rejected by the polling loop (same as above)
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          const stillPending = (constraints.video && window.__metanetPendingPermissions.includes("CAMERA")) 
                            || (constraints.audio && window.__metanetPendingPermissions.includes("RECORD_AUDIO"));
          if (!stillPending) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            console.log('[Metanet] User decision received, resuming getUserMedia');
            const cameraNowDenied = constraints.video && window.__metanetDeniedPermissions.includes("CAMERA");
            const micNowDenied    = constraints.audio && window.__metanetDeniedPermissions.includes("RECORD_AUDIO");
            if (cameraNowDenied || micNowDenied) {
              reject(new DOMException("Media access denied by user", "NotAllowedError"));
            } else {
              originalGetUserMedia(constraints).then(resolve).catch(reject);
            }
          }
        }, 100);
        const timeoutId = setTimeout(() => {
          clearInterval(checkInterval);
          console.error('[Metanet] Permission request timed out');
          reject(new DOMException("Permission request timed out", "NotAllowedError"));
        }, 60000);
      });
    };
  }
           
  // Handle geolocation access
  if (navigator.geolocation) {
    const originalGetPos = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    const originalWatchPos = navigator.geolocation.watchPosition.bind(navigator.geolocation);
    navigator.geolocation.__originalGetCurrentPosition = originalGetPos;
    navigator.geolocation.__originalWatchPosition = originalWatchPos;

    // If location already denied for this domain, override to error immediately
    if (window.__metanetDeniedPermissions.includes("ACCESS_FINE_LOCATION")) {
      console.log('[Metanet] Location access denied by site settings');
      navigator.geolocation.getCurrentPosition = function(success, error) {
        if (error) error(new Error("Location access denied by site settings"));
      };
      navigator.geolocation.watchPosition = function(success, error) {
        if (error) error(new Error("Location access denied by site settings"));
        return 0;  // return dummy watch ID
      };
    } 
    // If a location request is pending, override to wait until decision
    else if (window.__metanetPendingPermissions.includes("ACCESS_FINE_LOCATION")) {
      console.log('[Metanet] Location permission request pending user decision');
      navigator.geolocation.getCurrentPosition = function(success, error, options) {
        console.log('[Metanet] getCurrentPosition called while permission decision pending');
        const checkInterval = setInterval(() => {
          if (!window.__metanetPendingPermissions.includes("ACCESS_FINE_LOCATION")) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            // Now check decision:
            if (window.__metanetDeniedPermissions.includes("ACCESS_FINE_LOCATION")) {
              console.log('[Metanet] User denied location permission');
              if (error) error(new Error("Location access denied by user"));
            } else {
              console.log('[Metanet] User allowed location permission, proceeding with request');
              originalGetPos(success, error, options);  // call original
            }
          }
        }, 100);
        const timeoutId = setTimeout(() => {
          clearInterval(checkInterval);
          console.warn('[Metanet] Location permission request timed out');
          if (error) error(new Error("Permission request timed out"));
        }, 60000);
      };
      navigator.geolocation.watchPosition = function(success, error, options) {
        console.log('[Metanet] watchPosition called while permission decision pending');
        // We won't start watching until decision; return a dummy ID for now:
        const tempId = -1;
        const checkInterval = setInterval(() => {
          if (!window.__metanetPendingPermissions.includes("ACCESS_FINE_LOCATION")) {
            clearInterval(checkInterval);
            if (window.__metanetDeniedPermissions.includes("ACCESS_FINE_LOCATION")) {
              console.log('[Metanet] User denied location permission');
              if (error) error(new Error("Location access denied by user"));
            } else {
              console.log('[Metanet] User allowed location permission, starting watch');
              navigator.geolocation.__originalWatchPosition.call(navigator.geolocation, success, error, options);
            }
          }
        }, 100);
        return tempId;
      };
    } 
    // If not denied and no pending request yet, we intercept new requests similarly:
    else {
      navigator.geolocation.getCurrentPosition = function(success, error, options) {
        // Mark pending and ask native side:
        window.__metanetPendingPermissions.push("ACCESS_FINE_LOCATION");
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'REQUEST_LOCATION' }));
        console.log('[Metanet] Requesting geolocation, awaiting user decision...');
        // Defer the actual call until decision (polling loop similar to above):
        const checkInterval = setInterval(() => {
          if (!window.__metanetPendingPermissions.includes("ACCESS_FINE_LOCATION")) {
            clearInterval(checkInterval);
            clearTimeout(timeoutId);
            if (window.__metanetDeniedPermissions.includes("ACCESS_FINE_LOCATION")) {
              if (error) error(new Error("Location access denied by user"));
            } else {
              originalGetPos(success, error, options);
            }
          }
        }, 100);
        const timeoutId = setTimeout(() => {
          clearInterval(checkInterval);
          if (error) error(new Error("Permission request timed out"));
        }, 60000);
      };
      navigator.geolocation.watchPosition = function(success, error, options) {
        window.__metanetPendingPermissions.push("ACCESS_FINE_LOCATION");
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'REQUEST_LOCATION' }));
        console.log('[Metanet] Requesting geolocation (watch), awaiting user decision...');
        let tempId = -1;
        const checkInterval = setInterval(() => {
          if (!window.__metanetPendingPermissions.includes("ACCESS_FINE_LOCATION")) {
            clearInterval(checkInterval);
            if (window.__metanetDeniedPermissions.includes("ACCESS_FINE_LOCATION")) {
              if (error) error(new Error("Location access denied by user"));
            } else {
              // user allowed
              tempId = navigator.geolocation.__originalWatchPosition.call(navigator.geolocation, success, error, options);
            }
          }
        }, 100);
        return tempId;
      };
    }
  }
})();`
}

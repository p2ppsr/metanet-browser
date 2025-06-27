import React, { createContext, useContext, useState, ReactNode } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Detect language with multiple fallback methods
let detectedLanguage = 'en';

try {
  // Try expo-localization first (most reliable for Expo apps)
  const Localization = require('expo-localization');
  const deviceLanguage = Localization.getLocales()?.[0]?.languageCode;
  if (deviceLanguage) {
    detectedLanguage = deviceLanguage;
    console.log('🌍 Device language detected via expo-localization:', deviceLanguage);
    console.log('🔤 Detected language code:', detectedLanguage);
    console.log('📱 Full locale info:', Localization.getLocales()?.[0]);
  } else {
    throw new Error('expo-localization returned no language');
  }
} catch (localeError) {
  console.warn('⚠️ expo-localization not available, trying react-native-localize:', localeError.message);
  
  try {
    // Fallback to react-native-localize
    const { getLocales } = require('react-native-localize');
    const deviceLocales = getLocales();
    detectedLanguage = deviceLocales[0]?.languageCode || 'en';
    console.log('🌍 Device locales detected via react-native-localize:', deviceLocales);
    console.log('🔤 Detected language code:', detectedLanguage);
    console.log('📱 Full locale info:', deviceLocales[0]);
  } catch (rnLocalizeError) {
    console.warn('⚠️ react-native-localize also not available:', rnLocalizeError.message);
    
    try {
      // Enhanced fallback to platform-specific detection
      const { Platform } = require('react-native');
    
    if (Platform.OS === 'ios') {
      console.log('🍎 iOS detected, trying enhanced locale detection...');
      const { NativeModules } = require('react-native');
      
      // Try multiple iOS methods
      let iosLocale = null;
      
      // Method 1: SettingsManager AppleLocale
      if (NativeModules.SettingsManager?.settings?.AppleLocale) {
        iosLocale = NativeModules.SettingsManager.settings.AppleLocale;
        console.log('🍎 iOS AppleLocale found:', iosLocale);
      }
      
      // Method 2: SettingsManager AppleLanguages array
      if (!iosLocale && NativeModules.SettingsManager?.settings?.AppleLanguages) {
        const languages = NativeModules.SettingsManager.settings.AppleLanguages;
        iosLocale = languages[0];
        console.log('🍎 iOS AppleLanguages found:', languages, '-> using:', iosLocale);
      }
      
      // Method 3: I18nManager
      if (!iosLocale) {
        const { I18nManager } = require('react-native');
        if (I18nManager.localeIdentifier) {
          iosLocale = I18nManager.localeIdentifier;
          console.log('🍎 iOS I18nManager localeIdentifier found:', iosLocale);
        }
      }
      
      if (iosLocale) {
        // Extract language code (handle both "es_ES" and "es-ES" formats)
        detectedLanguage = String(iosLocale).split(/[-_]/)[0];
        console.log('🔤 iOS extracted language code:', detectedLanguage);
      } else {
        console.log('🍎 No iOS locale found, using default: en');
      }
      
    } else if (Platform.OS === 'android') {
      console.log('🤖 Android detected, trying locale detection...');
      const { I18nManager } = require('react-native');
      if (I18nManager.localeIdentifier) {
        detectedLanguage = I18nManager.localeIdentifier.split(/[-_]/)[0];
        console.log('🤖 Android locale detected:', I18nManager.localeIdentifier, '-> extracted:', detectedLanguage);
      }
    } else {
      console.log('🌐 Web/other platform detected...');
      // Web fallback
      if (typeof navigator !== 'undefined' && navigator.language) {
        detectedLanguage = navigator.language.split(/[-_]/)[0];
        console.log('🌐 Web locale detected:', navigator.language, '-> extracted:', detectedLanguage);
      }
    }
    } catch (platformError) {
      console.warn('⚠️ Platform-specific locale detection failed:', platformError.message);
      detectedLanguage = 'en';
      console.log('🔧 Using default language: en');
    }
  }
}

const resources = {
  en: {
    translation: {
      // Navigation
      search_placeholder: 'Search or enter site name',
      search_bookmarks: 'Search bookmarks…',
      search_results: 'Search Results',
      new_tab: 'New Tab',
      back: 'Back',
      forward: 'Forward',
      refresh: 'Refresh',
      share: 'Share',
      
      // Bookmarks
      bookmark: 'Bookmark',
      bookmarks: 'Bookmarks',
      add_bookmark: 'Add Bookmark',
      remove_bookmark: 'Remove Bookmark',
      delete_bookmark: 'Delete Bookmark',
      recent_bookmarks: 'Recent Bookmarks',
      no_bookmarks: 'No bookmarks yet',
      
      // History
      history: 'History',
      clear: 'Clear',
      
      // General UI
      untitled: 'Untitled',
      website_notification: 'Website Notification',
      
      // Apps & Homepage
      recent: 'Recent',
      recommended: 'Recommended',
      customize_homepage: 'Customize Homepage',
      customize_homepage_description: 'Show or hide sections on your homepage',
      show_bookmarks: 'Show Bookmarks',
      show_recent_apps: 'Show Recent Apps',
      show_recommended_apps: 'Show Recommended Apps',
      hide_app: 'Hide App',
      
      // Actions
      cancel: 'Cancel',
      done: 'Done',
      reset: 'Reset',
      ok: 'OK',
      yes: 'Yes',
      no: 'No',
      
      // Navigation actions
      switch_to_mobile_view: 'Switch to Mobile View',
      switch_to_desktop_view: 'Switch to Desktop View',
      add_to_device_homescreen: 'Add to Device Homescreen',
      back_to_homepage: 'Back to Homepage',
      notifications: 'Notifications',
      
      // Browser actions
      clear_browsing_history: 'Clear browsing history?',
      action_cannot_be_undone: 'This action cannot be undone.',
      
      // Wallet
      balance: 'Balance',
      send: 'Send',
      receive: 'Receive',
      wallet: 'Wallet',
      identity: 'Identity',
      
      // Identity
      manage_digital_identity: 'Manage your digital identity and credentials.',
      identity_key: 'Identity Key:',
      privileged_identity_key: 'Privileged Identity Key:',
      reveal_key: 'Reveal Key',
      wallet_manager_not_available: 'Wallet manager not available',
      failed_to_reveal_key: 'Failed to reveal key',
      privileged_reason: 'Reveal your privileged identity key alongside your everyday one.',
      
      // Settings
      settings: 'Settings',
      theme: 'Theme',
      currency_format: 'Currency Format',
      language: 'Language',
      appearance: 'Appearance',
      choose_theme_mode: 'Choose your preferred theme mode',
      light: 'Light',
      dark: 'Dark',
      system_default: 'System Default',
      account: 'Account',
      logout: 'Logout',
      
      // Security
      security: 'Security',
      manage_password_recovery: 'Manage your password and recovery key.',
      change_password: 'Change Password',
      change_password_prompt: 'You will be prompted to enter your old password to confirm the change.',
      new_password: 'New password',
      retype_password: 'Retype password',
      forgot_password: 'Forgot Password?',
      forgot_password_flow: 'Forgot password flow',
      change: 'Change',
      recovery_key: 'Recovery Key',
      recovery_key_description: 'You will need your recovery key if you forget your password or lose your phone.',
      view: 'View',
      change_recovery_key: 'Change recovery key (mock)',
      password_too_short: 'Password too short',
      passwords_do_not_match: 'Passwords do not match',
      success: 'Success',
      password_changed_mock: 'Password changed (mock)',
      recovery_key_mock: '•••••••••••••• (mock)',
      
      // Notifications
      notification_permission: 'Notification Permission',
      allow_notifications: 'Allow notifications from this site?',
      allow: 'Allow',
      block: 'Block',
      allow_notifications_question: 'Allow notifications?',
      wants_to_send_notifications: 'wants to send you notifications',
      can_send_notifications_about: 'This site can send you notifications about:',
      breaking_news_updates: '• Breaking news and updates',
      messages_activity: '• Messages and activity', 
      reminders_alerts: '• Reminders and alerts',
      change_in_settings: 'You can change this in Settings at any time.',
      requesting: 'Requesting...',
      
      // Errors
      error_loading_page: 'Error loading page',
      no_internet: 'No internet connection',
      invalid_url: 'Invalid URL',
      something_went_wrong: 'Something went wrong',
      error: 'Error',
      configuration_error: 'Configuration Error',
      could_not_fetch_wallet_config: 'Could not fetch wallet configuration:',
      failed_to_save_config: 'Failed to save configuration. Please try again.',
      
      // Configuration
      configuration: 'Configuration',
      save: 'Save',
      wallet_auth_backend: 'Wallet Authentication Backend (WAB)',
      wab_description: 'Provides 2 of 3 backup and recovery functionality for your root key.',
      wab_url: 'WAB URL',
      enter_wab_url: 'Enter WAB URL',
      refresh_info: 'Refresh Info',
      phone_verification_service: 'Service which will be used to verify your phone number',
      bsv_network: 'BSV Network',
      wallet_storage_provider: 'Wallet Storage Provider',
      storage_description: 'Used for your transactions and metadata storage.',
      storage_url: 'Storage URL',
      enter_storage_url: 'Enter Storage URL',
      
      // States
      loading: 'Loading...',
      no_results: 'No results found',
      empty: 'Empty',
      
      // Units
      satoshis: 'satoshis',
      sats: 'sats',
      
      // Trust
      trust_network: 'Trust Network',
      trusted_origins: 'Trusted Origins',
      manage_trust_relationships: 'Manage your trust relationships and certifier network.',
      search_trusted_origins: 'Search trusted origins…',
      no_trusted_origins: 'No trusted origins yet.',
      trusted: 'Trusted',
      
      // Auth - Password
      enter_password: 'Enter Password',
      enter_password_continue: 'Please enter your password to continue',
      password: 'Password',
      password_min_chars: 'Password must be at least 6 characters',
      continue: 'Continue',
      forgot_password_link: 'Forgot password?',
      auth_failed_maybe_password: 'Authentication failed, maybe password is incorrect?',
      auth_failed_try_again: 'Authentication failed. Please try again.',
      
      // Auth - Phone
      enter_phone_number: 'Enter your phone number',
      send_verification_code: "We'll send you a verification code",
      phone_number: 'Phone number',
      select_country: 'Select Country',
      terms_privacy_agree: 'By continuing, you agree to our Terms of Service and Privacy Policy',
      
      // Auth - OTP
      verification_code: 'Verification Code',
      enter_6_digit_code: 'Enter the 6-digit code sent to',
      didnt_receive_code: "Didn't receive the code?",
      resend_code: 'Resend Code',
      resend_in: 'Resend in',
      change_phone_number: 'Change Phone Number',
      verification_failed: 'Verification Failed',
      code_incorrect_try_again: 'The code you entered is incorrect. Please try again.',
      code_sent: 'Code Sent',
      new_verification_code_sent: 'A new verification code has been sent to your phone.',
      failed_to_resend: 'Failed to resend verification code. Please try again.',
      failed_resend_code: 'Failed to resend verification code. Please try again.',
    }
  },
  zh: {
    translation: {
      // Navigation
      search_placeholder: '搜索或输入网站名称',
      search_bookmarks: '搜索书签…',
      new_tab: '新标签页',
      back: '后退',
      forward: '前进',
      refresh: '刷新',
      share: '分享',
      
      // Bookmarks
      bookmark: '书签',
      bookmarks: '书签',
      remove_bookmark: '移除书签',
      delete_bookmark: '删除书签',
      recent_bookmarks: '最近书签',
      no_bookmarks: '暂无书签',
      
      // History
      history: '历史记录',
      clear: '清除',
      
      // General UI
      untitled: '无标题',
      website_notification: '网站通知',
      
      // Apps & Homepage
      recent: '最近',
      recommended: '推荐',
      customize_homepage: '自定义主页',
      customize_homepage_description: '显示或隐藏主页上的部分',
      show_bookmarks: '显示书签',
      show_recent_apps: '显示最近应用',
      show_recommended_apps: '显示推荐应用',
      hide_app: '隐藏应用',
      
      // Actions
      cancel: '取消',
      done: '完成',
      reset: '重置',
      ok: '确定',
      yes: '是',
      no: '否',
      
      // Browser actions
      clear_browsing_history: '清除浏览历史记录？',
      action_cannot_be_undone: '此操作无法撤销。',
      
      // Wallet
      balance: '余额',
      send: '发送',
      receive: '接收',
      wallet: '钱包',
      identity: '身份',
      
      // Settings
      settings: '设置',
      theme: '主题',
      currency_format: '货币格式',
      language: '语言',
      
      // Notifications
      notification_permission: '通知权限',
      allow_notifications: '允许此网站发送通知？',
      allow: '允许',
      block: '阻止',
      
      // Errors
      error_loading_page: '页面加载错误',
      no_internet: '无网络连接',
      invalid_url: '无效网址',
      something_went_wrong: '出现错误',
      error: '错误',
      configuration_error: '配置错误',
      could_not_fetch_wallet_config: '无法获取钱包配置：',
      failed_to_save_config: '保存配置失败。请重试。',
      
      // Configuration
      configuration: '配置',
      save: '保存',
      wallet_auth_backend: '钱包身份验证后端 (WAB)',
      wab_description: '为您的根密钥提供2/3备份和恢复功能。',
      wab_url: 'WAB URL',
      enter_wab_url: '输入 WAB URL',
      refresh_info: '刷新信息',
      phone_verification_service: '将用于验证您电话号码的服务',
      bsv_network: 'BSV 网络',
      wallet_storage_provider: '钱包存储提供商',
      storage_description: '用于您的交易和元数据存储。',
      storage_url: '存储 URL',
      enter_storage_url: '输入存储 URL',
      
      // States
      loading: '加载中...',
      no_results: '未找到结果',
      empty: '空',
      
      // Units
      satoshis: '聪',
      sats: '聪',
      
      // Trust
      trust_network: '信任网络',
      trusted_origins: '可信来源',
      manage_trust_relationships: '管理您的信任关系和认证网络。',
      search_trusted_origins: '搜索可信来源…',
      no_trusted_origins: '暂无可信来源。',
      trusted: '可信',
      
      // Identity
      manage_digital_identity: '管理您的数字身份和凭证。',
      identity_key: '身份密钥：',
      privileged_identity_key: '特权身份密钥：',
      reveal_key: '显示密钥',
      wallet_manager_not_available: '钱包管理器不可用',
      failed_to_reveal_key: '显示密钥失败',
      privileged_reason: '显示您的特权身份密钥和日常密钥。',
      
      // Security
      security: '安全',
      manage_password_recovery: '管理您的密码和恢复密钥。',
      change_password: '更改密码',
      change_password_prompt: '您将被提示输入旧密码以确认更改。',
      new_password: '新密码',
      retype_password: '重新输入密码',
      forgot_password: '忘记密码？',
      forgot_password_flow: '忘记密码流程',
      change: '更改',
      recovery_key: '恢复密钥',
      recovery_key_description: '如果您忘记密码或丢失手机，您将需要恢复密钥。',
      view: '查看',
      change_recovery_key: '更改恢复密钥（模拟）',
      password_too_short: '密码太短',
      passwords_do_not_match: '密码不匹配',
      success: '成功',
      password_changed_mock: '密码已更改（模拟）',
      recovery_key_mock: '•••••••••••••• （模拟）',
      
      // Settings (extended)
      appearance: '外观',
      choose_theme_mode: '选择您喜欢的主题模式',
      light: '浅色',
      dark: '深色',
      system_default: '系统默认',
      account: '账户',
      logout: '退出登录',
      
      // Notifications (extended)
      allow_notifications_question: '允许通知？',
      wants_to_send_notifications: '想要向您发送通知',
      can_send_notifications_about: '此网站可以向您发送以下通知：',
      breaking_news_updates: '• 突发新闻和更新',
      messages_activity: '• 消息和活动',
      reminders_alerts: '• 提醒和警报',
      change_in_settings: '您可以随时在设置中更改此选项。',
      requesting: '请求中...',
      
      // Navigation (extended)
      search_results: '搜索结果',
      add_bookmark: '添加书签',
      
      // Navigation actions
      switch_to_mobile_view: '切换到移动视图',
      switch_to_desktop_view: '切换到桌面视图',
      add_to_device_homescreen: '添加到设备主屏幕',
      back_to_homepage: '返回主页',
      notifications: '通知',
      
      // Auth - Password
      enter_password: '输入密码',
      enter_password_continue: '请输入您的密码以继续',
      password: '密码',
      password_min_chars: '密码必须至少6个字符',
      continue: '继续',
      forgot_password_link: '忘记密码？',
      auth_failed_maybe_password: '验证失败，可能密码不正确？',
      auth_failed_try_again: '验证失败。请重试。',
      
      // Auth - Phone
      enter_phone_number: '输入您的电话号码',
      send_verification_code: '我们将向您发送验证码',
      phone_number: '电话号码',
      select_country: '选择国家',
      terms_privacy_agree: '继续即表示您同意我们的服务条款和隐私政策',
      
      // Auth - OTP
      verification_code: '验证码',
      enter_6_digit_code: '输入发送到以下号码的6位数字代码',
      didnt_receive_code: '没有收到验证码？',
      resend_code: '重新发送验证码',
      resend_in: '重新发送时间',
      change_phone_number: '更改电话号码',
      verification_failed: '验证失败',
      code_incorrect_try_again: '您输入的验证码不正确。请重试。',
      code_sent: '验证码已发送',
      new_verification_code_sent: '新的验证码已发送到您的手机。',
      failed_to_resend: '重新发送验证码失败。请重试。',
      failed_resend_code: '重新发送验证码失败。请重试。',
    }
  },
  hi: {
    translation: {
      // Navigation
      search_placeholder: 'खोजें या साइट का नाम दर्ज करें',
      new_tab: 'नया टैब',
      back: 'पीछे',
      forward: 'आगे',
      refresh: 'ताज़ा करें',
      share: 'साझा करें',
      
      // Bookmarks
      bookmark: 'बुकमार्क',
      bookmarks: 'बुकमार्क',
      remove_bookmark: 'बुकमार्क हटाएं',
      delete_bookmark: 'बुकमार्क मिटाएं',
      recent_bookmarks: 'हाल के बुकमार्क',
      no_bookmarks: 'अभी तक कोई बुकमार्क नहीं',
      
      // History
      history: 'इतिहास',
      clear: 'साफ़ करें',
      
      // General UI
      untitled: 'बिना शीर्षक',
      website_notification: 'वेबसाइट सूचना',
      
      // Apps & Homepage
      recent: 'हाल ही में',
      recommended: 'अनुशंसित',
      customize_homepage: 'होमपेज को अनुकूलित करें',
      customize_homepage_description: 'अपने होमपेज पर सेक्शन दिखाएं या छुपाएं',
      show_bookmarks: 'बुकमार्क दिखाएं',
      show_recent_apps: 'हाल के ऐप्स दिखाएं',
      show_recommended_apps: 'अनुशंसित ऐप्स दिखाएं',
      hide_app: 'ऐप छुपाएं',
      
      // Actions
      cancel: 'रद्द करें',
      done: 'हो गया',
      reset: 'रीसेट करें',
      ok: 'ठीक है',
      yes: 'हाँ',
      no: 'नहीं',
      
      // Browser actions
      clear_browsing_history: 'ब्राउज़िंग इतिहास साफ़ करें?',
      action_cannot_be_undone: 'यह क्रिया पूर्ववत नहीं की जा सकती।',
      
      // Wallet
      balance: 'शेष राशि',
      send: 'भेजें',
      receive: 'प्राप्त करें',
      wallet: 'वॉलेट',
      identity: 'पहचान',
      
      // Settings
      settings: 'सेटिंग्स',
      theme: 'थीम',
      currency_format: 'मुद्रा प्रारूप',
      language: 'भाषा',
      
      // Notifications
      notification_permission: 'अधिसूचना अनुमति',
      allow_notifications: 'इस साइट से अधिसूचनाओं की अनुमति दें?',
      allow: 'अनुमति दें',
      block: 'ब्लॉक करें',
      
      // Errors
      error_loading_page: 'पेज लोड करने में त्रुटि',
      no_internet: 'इंटरनेट कनेक्शन नहीं',
      invalid_url: 'अमान्य URL',
      something_went_wrong: 'कुछ गलत हुआ',
      
      // States
      loading: 'लोड हो रहा है...',
      no_results: 'कोई परिणाम नहीं मिला',
      empty: 'खाली',
      
      // Units
      satoshis: 'सातोशी',
      sats: 'सैट्स',
      
      // Trust
      trust_network: 'विश्वास नेटवर्क',
      trusted_origins: 'विश्वसनीय स्रोत',
      manage_trust_relationships: 'अपने विश्वास संबंधों और प्रमाणक नेटवर्क का प्रबंधन करें।',
      search_trusted_origins: 'विश्वसनीय स्रोत खोजें…',
      no_trusted_origins: 'अभी तक कोई विश्वसनीय स्रोत नहीं।',
      trusted: 'विश्वसनीय',
      
      // Auth - Password
      enter_password: 'पासवर्ड दर्ज करें',
      enter_password_continue: 'कृपया जारी रखने के लिए अपना पासवर्ड दर्ज करें',
      password: 'पासवर्ड',
      password_min_chars: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए',
      continue: 'जारी रखें',
      forgot_password_link: 'पासवर्ड भूल गए?',
      auth_failed_maybe_password: 'प्रमाणीकरण विफल, शायद पासवर्ड गलत है?',
      auth_failed_try_again: 'प्रमाणीकरण विफल। कृपया पुनः प्रयास करें।',
      
      // Auth - OTP
      enter_verification_code: 'सत्यापन कोड दर्ज करें',
      enter_6_digit_code: 'अपने फोन पर भेजा गया 6-अंकीय कोड दर्ज करें',
      verify: 'सत्यापित करें',
      resend_code: 'कोड पुनः भेजें',
      invalid_code: 'अमान्य कोड',
      
      // Auth - Phone
      enter_phone_number: 'फोन नंबर दर्ज करें',
      phone_number_required: 'जारी रखने के लिए फोन नंबर आवश्यक है',
      phone_number: 'फोन नंबर',
      send_verification_code: 'सत्यापन कोड भेजें',
      invalid_phone_number: 'अमान्य फोन नंबर',
    }
  },
  es: {
    translation: {
      // Navigation
      search_placeholder: 'Buscar o ingresar nombre del sitio',
      new_tab: 'Nueva Pestaña',
      back: 'Atrás',
      forward: 'Adelante',
      refresh: 'Actualizar',
      share: 'Compartir',
      
      // Bookmarks
      bookmark: 'Marcador',
      bookmarks: 'Marcadores',
      remove_bookmark: 'Eliminar Marcador',
      delete_bookmark: 'Eliminar Marcador',
      recent_bookmarks: 'Marcadores Recientes',
      no_bookmarks: 'No hay marcadores aún',
      
      // History
      history: 'Historial',
      clear: 'Limpiar',
      
      // General UI
      untitled: 'Sin título',
      website_notification: 'Notificación del sitio web',
      
      // Apps & Homepage
      recent: 'Reciente',
      recommended: 'Recomendado',
      customize_homepage: 'Personalizar Página de Inicio',
      customize_homepage_description: 'Mostrar u ocultar secciones en tu página de inicio',
      show_bookmarks: 'Mostrar Marcadores',
      show_recent_apps: 'Mostrar Apps Recientes',
      show_recommended_apps: 'Mostrar Apps Recomendadas',
      hide_app: 'Ocultar App',
      
      // Actions
      cancel: 'Cancelar',
      done: 'Hecho',
      reset: 'Restablecer',
      ok: 'OK',
      yes: 'Sí',
      no: 'No',
      
      // Navigation actions
      switch_to_mobile_view: 'Cambiar a Vista Móvil',
      switch_to_desktop_view: 'Cambiar a Vista de Escritorio',
      add_to_device_homescreen: 'Agregar a Pantalla de Inicio',
      back_to_homepage: 'Volver al Inicio',
      notifications: 'Notificaciones',
      
      // Browser actions
      clear_browsing_history: '¿Limpiar historial de navegación?',
      action_cannot_be_undone: 'Esta acción no se puede deshacer.',
      
      // Wallet
      balance: 'Saldo',
      send: 'Enviar',
      receive: 'Recibir',
      wallet: 'Billetera',
      identity: 'Identidad',
      
      // Settings
      settings: 'Configuración',
      theme: 'Tema',
      currency_format: 'Formato de Moneda',
      language: 'Idioma',
      
      // Notifications
      notification_permission: 'Permiso de Notificación',
      allow_notifications: '¿Permitir notificaciones de este sitio?',
      allow: 'Permitir',
      block: 'Bloquear',
      
      // Errors
      error_loading_page: 'Error al cargar la página',
      no_internet: 'Sin conexión a internet',
      invalid_url: 'URL inválida',
      something_went_wrong: 'Algo salió mal',
      
      // States
      loading: 'Cargando...',
      no_results: 'No se encontraron resultados',
      empty: 'Vacío',
      
      // Units
      satoshis: 'satoshis',
      sats: 'sats',
      
      // Trust
      trust_network: 'Red de Confianza',
    }
  },
  fr: {
    translation: {
      // Navigation
      search_placeholder: 'Rechercher ou saisir le nom du site',
      new_tab: 'Nouvel Onglet',
      back: 'Retour',
      forward: 'Suivant',
      refresh: 'Actualiser',
      share: 'Partager',
      
      // Bookmarks
      bookmark: 'Signet',
      bookmarks: 'Signets',
      remove_bookmark: 'Supprimer le Signet',
      delete_bookmark: 'Effacer le Signet',
      recent_bookmarks: 'Signets Récents',
      no_bookmarks: 'Aucun signet pour le moment',
      
      // History
      history: 'Historique',
      clear: 'Effacer',
      
      // General UI
      untitled: 'Sans titre',
      website_notification: 'Notification du site web',
      
      // Apps & Homepage
      recent: 'Récent',
      recommended: 'Recommandé',
      customize_homepage: 'Personnaliser la Page d\'Accueil',
      customize_homepage_description: 'Afficher ou masquer les sections sur votre page d\'accueil',
      show_bookmarks: 'Afficher les Signets',
      show_recent_apps: 'Afficher les Apps Récentes',
      show_recommended_apps: 'Afficher les Apps Recommandées',
      hide_app: 'Masquer l\'App',
      
      // Actions
      cancel: 'Annuler',
      done: 'Terminé',
      reset: 'Réinitialiser',
      ok: 'OK',
      yes: 'Oui',
      no: 'Non',
      
      // Browser actions
      clear_browsing_history: 'Effacer l\'historique de navigation ?',
      action_cannot_be_undone: 'Cette action ne peut pas être annulée.',
      
      // Wallet
      balance: 'Solde',
      send: 'Envoyer',
      receive: 'Recevoir',
      wallet: 'Portefeuille',
      identity: 'Identité',
      
      // Settings
      settings: 'Paramètres',
      theme: 'Thème',
      currency_format: 'Format de Devise',
      language: 'Langue',
      
      // Notifications
      notification_permission: 'Autorisation de Notification',
      allow_notifications: 'Autoriser les notifications de ce site ?',
      allow: 'Autoriser',
      block: 'Bloquer',
      
      // Errors
      error_loading_page: 'Erreur de chargement de la page',
      no_internet: 'Pas de connexion internet',
      invalid_url: 'URL invalide',
      something_went_wrong: 'Une erreur s\'est produite',
      
      // States
      loading: 'Chargement...',
      no_results: 'Aucun résultat trouvé',
      empty: 'Vide',
      
      // Units
      satoshis: 'satoshis',
      sats: 'sats',
      
      // Trust
      trust_network: 'Réseau de Confiance',
      trusted_origins: 'Origines de Confiance',
      manage_trust_relationships: 'Gérez vos relations de confiance et votre réseau de certificateurs.',
      search_trusted_origins: 'Rechercher les origines de confiance…',
      no_trusted_origins: 'Aucune origine de confiance pour le moment.',
      trusted: 'Approuvé',
      
      // Auth - Password
      enter_password: 'Entrer le Mot de Passe',
      enter_password_continue: 'Veuillez entrer votre mot de passe pour continuer',
      password: 'Mot de Passe',
      password_min_chars: 'Le mot de passe doit contenir au moins 6 caractères',
      continue: 'Continuer',
      forgot_password_link: 'Mot de passe oublié ?',
      auth_failed_maybe_password: 'Échec de l\'authentification, le mot de passe est peut-être incorrect ?',
      auth_failed_try_again: 'Échec de l\'authentification. Veuillez réessayer.',
      
      // Auth - OTP
      enter_verification_code: 'Entrer le Code de Vérification',
      enter_6_digit_code: 'Entrez le code à 6 chiffres envoyé à votre téléphone',
      verify: 'Vérifier',
      resend_code: 'Renvoyer le code',
      invalid_code: 'Code invalide',
      
      // Auth - Phone
      enter_phone_number: 'Entrer le Numéro de Téléphone',
      phone_number_required: 'Un numéro de téléphone est requis pour continuer',
      phone_number: 'Numéro de Téléphone',
      send_verification_code: 'Envoyer le Code de Vérification',
      invalid_phone_number: 'Numéro de téléphone invalide',
    }
  },
  ar: {
    translation: {
      // Navigation
      search_placeholder: 'ابحث أو أدخل اسم الموقع',
      new_tab: 'علامة تبويب جديدة',
      back: 'رجوع',
      forward: 'التالي',
      refresh: 'تحديث',
      share: 'مشاركة',
      
      // Bookmarks
      bookmark: 'إشارة مرجعية',
      bookmarks: 'الإشارات المرجعية',
      remove_bookmark: 'إزالة الإشارة المرجعية',
      delete_bookmark: 'حذف الإشارة المرجعية',
      recent_bookmarks: 'الإشارات المرجعية الحديثة',
      no_bookmarks: 'لا توجد إشارات مرجعية بعد',
      
      // History
      history: 'التاريخ',
      clear: 'مسح',
      
      // General UI
      untitled: 'بدون عنوان',
      website_notification: 'إشعار الموقع',
      
      // Apps & Homepage
      recent: 'حديث',
      recommended: 'موصى به',
      customize_homepage: 'تخصيص الصفحة الرئيسية',
      customize_homepage_description: 'إظهار أو إخفاء الأقسام في صفحتك الرئيسية',
      show_bookmarks: 'إظهار الإشارات المرجعية',
      show_recent_apps: 'إظهار التطبيقات الحديثة',
      show_recommended_apps: 'إظهار التطبيقات الموصى بها',
      hide_app: 'إخفاء التطبيق',
      
      // Actions
      cancel: 'إلغاء',
      done: 'تم',
      reset: 'إعادة تعيين',
      ok: 'موافق',
      yes: 'نعم',
      no: 'لا',
      
      // Browser actions
      clear_browsing_history: 'مسح تاريخ التصفح؟',
      action_cannot_be_undone: 'لا يمكن التراجع عن هذا الإجراء.',
      
      // Wallet
      balance: 'الرصيد',
      send: 'إرسال',
      receive: 'استقبال',
      wallet: 'محفظة',
      identity: 'الهوية',
      
      // Settings
      settings: 'الإعدادات',
      theme: 'المظهر',
      currency_format: 'تنسيق العملة',
      language: 'اللغة',
      
      // Notifications
      notification_permission: 'إذن الإشعارات',
      allow_notifications: 'السماح بالإشعارات من هذا الموقع؟',
      allow: 'السماح',
      block: 'حظر',
      
      // Errors
      error_loading_page: 'خطأ في تحميل الصفحة',
      no_internet: 'لا يوجد اتصال بالإنترنت',
      invalid_url: 'رابط غير صحيح',
      something_went_wrong: 'حدث خطأ ما',
      
      // States
      loading: 'جاري التحميل...',
      no_results: 'لم يتم العثور على نتائج',
      empty: 'فارغ',
      
      // Units
      satoshis: 'ساتوشي',
      sats: 'ساتس',
      
      // Trust
      trust_network: 'شبكة الثقة',
      trusted_origins: 'المصادر الموثوقة',
      manage_trust_relationships: 'إدارة علاقات الثقة وشبكة المصدقين الخاصة بك.',
      search_trusted_origins: 'البحث في المصادر الموثوقة…',
      no_trusted_origins: 'لا توجد مصادر موثوقة بعد.',
      trusted: 'موثوق',
      
      // Auth - Password
      enter_password: 'أدخل كلمة المرور',
      enter_password_continue: 'يرجى إدخال كلمة المرور للمتابعة',
      password: 'كلمة المرور',
      password_min_chars: 'يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل',
      continue: 'متابعة',
      forgot_password_link: 'نسيت كلمة المرور؟',
      auth_failed_maybe_password: 'فشل في المصادقة، ربما كلمة المرور غير صحيحة؟',
      auth_failed_try_again: 'فشل في المصادقة. يرجى المحاولة مرة أخرى.',
      
      // Auth - OTP
      enter_verification_code: 'أدخل رمز التحقق',
      enter_6_digit_code: 'أدخل الرمز المكون من 6 أرقام المرسل إلى هاتفك',
      verify: 'تحقق',
      resend_code: 'إعادة إرسال الرمز',
      invalid_code: 'رمز غير صالح',
      
      // Auth - Phone
      enter_phone_number: 'أدخل رقم الهاتف',
      phone_number_required: 'رقم الهاتف مطلوب للمتابعة',
      phone_number: 'رقم الهاتف',
      send_verification_code: 'إرسال رمز التحقق',
      invalid_phone_number: 'رقم هاتف غير صالح',
    }
  },
  pt: {
    translation: {
      // Navigation
      search_placeholder: 'Pesquisar ou digitar nome do site',
      new_tab: 'Nova Aba',
      back: 'Voltar',
      forward: 'Avançar',
      refresh: 'Atualizar',
      share: 'Compartilhar',
      
      // Bookmarks
      bookmark: 'Favorito',
      bookmarks: 'Favoritos',
      remove_bookmark: 'Remover Favorito',
      delete_bookmark: 'Excluir Favorito',
      recent_bookmarks: 'Favoritos Recentes',
      no_bookmarks: 'Nenhum favorito ainda',
      
      // History
      history: 'Histórico',
      clear: 'Limpar',
      
      // General UI
      untitled: 'Sem título',
      website_notification: 'Notificação do site',
      
      // Apps & Homepage
      recent: 'Recente',
      recommended: 'Recomendado',
      customize_homepage: 'Personalizar Página Inicial',
      customize_homepage_description: 'Mostrar ou ocultar seções na sua página inicial',
      show_bookmarks: 'Mostrar Favoritos',
      show_recent_apps: 'Mostrar Apps Recentes',
      show_recommended_apps: 'Mostrar Apps Recomendados',
      hide_app: 'Ocultar App',
      
      // Actions
      cancel: 'Cancelar',
      done: 'Concluído',
      reset: 'Redefinir',
      ok: 'OK',
      yes: 'Sim',
      no: 'Não',
      
      // Browser actions
      clear_browsing_history: 'Limpar histórico de navegação?',
      action_cannot_be_undone: 'Esta ação não pode ser desfeita.',
      
      // Wallet
      balance: 'Saldo',
      send: 'Enviar',
      receive: 'Receber',
      wallet: 'Carteira',
      identity: 'Identidade',
      
      // Settings
      settings: 'Configurações',
      theme: 'Tema',
      currency_format: 'Formato de Moeda',
      language: 'Idioma',
      
      // Notifications
      notification_permission: 'Permissão de Notificação',
      allow_notifications: 'Permitir notificações deste site?',
      allow: 'Permitir',
      block: 'Bloquear',
      
      // Errors
      error_loading_page: 'Erro ao carregar página',
      no_internet: 'Sem conexão com a internet',
      invalid_url: 'URL inválida',
      something_went_wrong: 'Algo deu errado',
      
      // States
      loading: 'Carregando...',
      no_results: 'Nenhum resultado encontrado',
      empty: 'Vazio',
      
      // Units
      satoshis: 'satoshis',
      sats: 'sats',
      
      // Trust
      trust_network: 'Rede de Confiança',
      trusted_origins: 'Origens Confiáveis',
      manage_trust_relationships: 'Gerencie suas relações de confiança e rede de certificadores.',
      search_trusted_origins: 'Pesquisar origens confiáveis…',
      no_trusted_origins: 'Nenhuma origem confiável ainda.',
      trusted: 'Confiável',
      
      // Auth - Password
      enter_password: 'Digite a Senha',
      enter_password_continue: 'Por favor, digite sua senha para continuar',
      password: 'Senha',
      password_min_chars: 'A senha deve ter pelo menos 6 caracteres',
      continue: 'Continuar',
      forgot_password_link: 'Esqueceu a senha?',
      auth_failed_maybe_password: 'Falha na autenticação, talvez a senha esteja incorreta?',
      auth_failed_try_again: 'Falha na autenticação. Tente novamente.',
      
      // Auth - OTP
      enter_verification_code: 'Digite o Código de Verificação',
      enter_6_digit_code: 'Digite o código de 6 dígitos enviado para seu telefone',
      verify: 'Verificar',
      resend_code: 'Reenviar código',
      invalid_code: 'Código inválido',
      
      // Auth - Phone
      enter_phone_number: 'Digite o Número do Telefone',
      phone_number_required: 'Um número de telefone é necessário para continuar',
      phone_number: 'Número do Telefone',
      send_verification_code: 'Enviar Código de Verificação',
      invalid_phone_number: 'Número de telefone inválido',
    }
  },
  bn: {
    translation: {
      // Navigation
      search_placeholder: 'অনুসন্ধান করুন বা সাইটের নাম লিখুন',
      new_tab: 'নতুন ট্যাব',
      back: 'পেছনে',
      forward: 'সামনে',
      refresh: 'রিফ্রেশ',
      share: 'শেয়ার',
      
      // Bookmarks
      bookmark: 'বুকমার্ক',
      bookmarks: 'বুকমার্কসমূহ',
      remove_bookmark: 'বুকমার্ক সরান',
      delete_bookmark: 'বুকমার্ক মুছুন',
      recent_bookmarks: 'সাম্প্রতিক বুকমার্ক',
      no_bookmarks: 'এখনও কোন বুকমার্ক নেই',
      
      // History
      history: 'ইতিহাস',
      clear: 'পরিষ্কার',
      
      // General UI
      untitled: 'শিরোনামহীন',
      website_notification: 'ওয়েবসাইট বিজ্ঞপ্তি',
      
      // Apps & Homepage
      recent: 'সাম্প্রতিক',
      recommended: 'প্রস্তাবিত',
      customize_homepage: 'হোমপেজ কাস্টমাইজ করুন',
      show_bookmarks: 'বুকমার্ক দেখান',
      show_recent_apps: 'সাম্প্রতিক অ্যাপস দেখান',
      show_recommended_apps: 'প্রস্তাবিত অ্যাপস দেখান',
      hide_app: 'অ্যাপ লুকান',
      
      // Actions
      cancel: 'বাতিল',
      done: 'সম্পন্ন',
      reset: 'রিসেট',
      ok: 'ঠিক আছে',
      yes: 'হ্যাঁ',
      no: 'না',
      
      // Browser actions
      clear_browsing_history: 'ব্রাউজিং ইতিহাস মুছবেন?',
      action_cannot_be_undone: 'এই কাজটি পূর্বাবস্থায় ফেরানো যাবে না।',
      
      // Wallet
      balance: 'ব্যালেন্স',
      send: 'পাঠান',
      receive: 'গ্রহণ করুন',
      wallet: 'ওয়ালেট',
      identity: 'পরিচয়',
      
      // Settings
      settings: 'সেটিংস',
      theme: 'থিম',
      currency_format: 'মুদ্রার ফরম্যাট',
      language: 'ভাষা',
      
      // Notifications
      notification_permission: 'নোটিফিকেশন অনুমতি',
      allow_notifications: 'এই সাইট থেকে নোটিফিকেশনের অনুমতি দিন?',
      allow: 'অনুমতি দিন',
      block: 'ব্লক করুন',
      
      // Errors
      error_loading_page: 'পেজ লোড করতে ত্রুটি',
      no_internet: 'ইন্টারনেট সংযোগ নেই',
      invalid_url: 'অবৈধ URL',
      something_went_wrong: 'কিছু ভুল হয়েছে',
      
      // States
      loading: 'লোড হচ্ছে...',
      no_results: 'কোন ফলাফল পাওয়া যায়নি',
      empty: 'খালি',
      
      // Units
      satoshis: 'সাতোশি',
      sats: 'স্যাটস',
      
      // Trust
      trust_network: 'বিশ্বস্ত নেটওয়ার্ক',
      trusted_origins: 'বিশ্বস্ত উৎস',
      manage_trust_relationships: 'আপনার বিশ্বস্ততার সম্পর্ক এবং সার্টিফাইয়ার নেটওয়ার্ক পরিচালনা করুন।',
      search_trusted_origins: 'বিশ্বস্ত উৎস অনুসন্ধান করুন…',
      no_trusted_origins: 'এখনও কোন বিশ্বস্ত উৎস নেই।',
      trusted: 'বিশ্বস্ত',
      
      // Auth - Password
      enter_password: 'পাসওয়ার্ড লিখুন',
      enter_password_continue: 'অনুগ্রহ করে চালিয়ে যেতে আপনার পাসওয়ার্ড লিখুন',
      password: 'পাসওয়ার্ড',
      password_min_chars: 'পাসওয়ার্ড কমপক্ষে ৬টি অক্ষর হতে হবে',
      continue: 'চালিয়ে যান',
      forgot_password_link: 'পাসওয়ার্ড ভুলে গেছেন?',
      auth_failed_maybe_password: 'প্রমাণীকরণ ব্যর্থ, সম্ভবত পাসওয়ার্ড ভুল?',
      auth_failed_try_again: 'প্রমাণীকরণ ব্যর্থ। আবার চেষ্টা করুন।',
      
      // Auth - OTP
      enter_verification_code: 'যাচাইকরণ কোড লিখুন',
      enter_6_digit_code: 'আপনার ফোনে পাঠানো ৬-সংখ্যার কোড লিখুন',
      verify: 'যাচাই করুন',
      resend_code: 'কোড পুনরায় পাঠান',
      invalid_code: 'অবৈধ কোড',
      
      // Auth - Phone
      enter_phone_number: 'ফোন নম্বর লিখুন',
      phone_number_required: 'চালিয়ে যেতে একটি ফোন নম্বর প্রয়োজন',
      phone_number: 'ফোন নম্বর',
      send_verification_code: 'যাচাইকরণ কোড পাঠান',
      invalid_phone_number: 'অবৈধ ফোন নম্বর',
    }
  },
  ru: {
    translation: {
      // Navigation
      search_placeholder: 'Поиск или ввод названия сайта',
      new_tab: 'Новая Вкладка',
      back: 'Назад',
      forward: 'Вперед',
      refresh: 'Обновить',
      share: 'Поделиться',
      
      // Bookmarks
      bookmark: 'Закладка',
      bookmarks: 'Закладки',
      remove_bookmark: 'Удалить Закладку',
      delete_bookmark: 'Удалить Закладку',
      recent_bookmarks: 'Недавние Закладки',
      no_bookmarks: 'Пока нет закладок',
      
      // History
      history: 'История',
      clear: 'Очистить',
      
      // General UI
      untitled: 'Без названия',
      website_notification: 'Уведомление сайта',
      
      // Apps & Homepage
      recent: 'Недавние',
      recommended: 'Рекомендуемые',
      customize_homepage: 'Настроить Главную Страницу',
      show_bookmarks: 'Показать Закладки',
      show_recent_apps: 'Показать Недавние Приложения',
      show_recommended_apps: 'Показать Рекомендуемые Приложения',
      hide_app: 'Скрыть Приложение',
      
      // Actions
      cancel: 'Отмена',
      done: 'Готово',
      reset: 'Сбросить',
      ok: 'OK',
      yes: 'Да',
      no: 'Нет',
      
      // Browser actions
      clear_browsing_history: 'Очистить историю браузера?',
      action_cannot_be_undone: 'Это действие нельзя отменить.',
      
      // Wallet
      balance: 'Баланс',
      send: 'Отправить',
      receive: 'Получить',
      wallet: 'Кошелек',
      identity: 'Личность',
      
      // Settings
      settings: 'Настройки',
      theme: 'Тема',
      currency_format: 'Формат Валюты',
      language: 'Язык',
      
      // Notifications
      notification_permission: 'Разрешение на Уведомления',
      allow_notifications: 'Разрешить уведомления с этого сайта?',
      allow: 'Разрешить',
      block: 'Заблокировать',
      
      // Errors
      error_loading_page: 'Ошибка загрузки страницы',
      no_internet: 'Нет подключения к интернету',
      invalid_url: 'Неверный URL',
      something_went_wrong: 'Что-то пошло не так',
      
      // States
      loading: 'Загрузка...',
      no_results: 'Результаты не найдены',
      empty: 'Пусто',
      
      // Units
      satoshis: 'сатоши',
      sats: 'сатс',
      
      // Trust
      trust_network: 'Сеть Доверия',
      trusted_origins: 'Доверенные Источники',
      manage_trust_relationships: 'Управляйте своими доверительными отношениями и сетью сертификаторов.',
      search_trusted_origins: 'Поиск доверенных источников…',
      no_trusted_origins: 'Пока нет доверенных источников.',
      trusted: 'Доверенный',
      
      // Auth - Password
      enter_password: 'Введите Пароль',
      enter_password_continue: 'Пожалуйста, введите свой пароль для продолжения',
      password: 'Пароль',
      password_min_chars: 'Пароль должен содержать минимум 6 символов',
      continue: 'Продолжить',
      forgot_password_link: 'Забыли пароль?',
      auth_failed_maybe_password: 'Ошибка аутентификации, возможно, неверный пароль?',
      auth_failed_try_again: 'Ошибка аутентификации. Попробуйте снова.',
      
      // Auth - OTP
      enter_verification_code: 'Введите Код Подтверждения',
      enter_6_digit_code: 'Введите 6-значный код, отправленный на ваш телефон',
      verify: 'Подтвердить',
      resend_code: 'Отправить код повторно',
      invalid_code: 'Неверный код',
      
      // Auth - Phone
      enter_phone_number: 'Введите Номер Телефона',
      phone_number_required: 'Для продолжения необходим номер телефона',
      phone_number: 'Номер Телефона',
      send_verification_code: 'Отправить Код Подтверждения',
      invalid_phone_number: 'Неверный номер телефона',
    }
  },
  id: {
    translation: {
      // Navigation
      search_placeholder: 'Cari atau masukkan nama situs',
      new_tab: 'Tab Baru',
      back: 'Kembali',
      forward: 'Maju',
      refresh: 'Segarkan',
      share: 'Bagikan',
      
      // Bookmarks
      bookmark: 'Bookmark',
      bookmarks: 'Bookmark',
      remove_bookmark: 'Hapus Bookmark',
      delete_bookmark: 'Hapus Bookmark',
      recent_bookmarks: 'Bookmark Terbaru',
      no_bookmarks: 'Belum ada bookmark',
      
      // History
      history: 'Riwayat',
      clear: 'Bersihkan',
      
      // General UI
      untitled: 'Tanpa judul',
      website_notification: 'Notifikasi situs web',
      
      // Apps & Homepage
      recent: 'Terbaru',
      recommended: 'Direkomendasikan',
      customize_homepage: 'Sesuaikan Beranda',
      show_bookmarks: 'Tampilkan Bookmark',
      show_recent_apps: 'Tampilkan Aplikasi Terbaru',
      show_recommended_apps: 'Tampilkan Aplikasi yang Direkomendasikan',
      hide_app: 'Sembunyikan Aplikasi',
      
      // Actions
      cancel: 'Batal',
      done: 'Selesai',
      reset: 'Atur Ulang',
      ok: 'OK',
      yes: 'Ya',
      no: 'Tidak',
      
      // Browser actions
      clear_browsing_history: 'Hapus riwayat penjelajahan?',
      action_cannot_be_undone: 'Tindakan ini tidak dapat dibatalkan.',
      
      // Wallet
      balance: 'Saldo',
      send: 'Kirim',
      receive: 'Terima',
      wallet: 'Dompet',
      identity: 'Identitas',
      
      // Settings
      settings: 'Pengaturan',
      theme: 'Tema',
      currency_format: 'Format Mata Uang',
      language: 'Bahasa',
      
      // Notifications
      notification_permission: 'Izin Notifikasi',
      allow_notifications: 'Izinkan notifikasi dari situs ini?',
      allow: 'Izinkan',
      block: 'Blokir',
      
      // Errors
      error_loading_page: 'Error memuat halaman',
      no_internet: 'Tidak ada koneksi internet',
      invalid_url: 'URL tidak valid',
      something_went_wrong: 'Ada yang salah',
      
      // States
      loading: 'Memuat...',
      no_results: 'Tidak ada hasil ditemukan',
      empty: 'Kosong',
      
      // Units
      satoshis: 'satoshi',
      sats: 'sats',
      
      // Trust
      trust_network: 'Jaringan Kepercayaan',
      trusted_origins: 'Sumber Terpercaya',
      manage_trust_relationships: 'Kelola hubungan kepercayaan dan jaringan sertifikator Anda.',
      search_trusted_origins: 'Cari sumber terpercaya…',
      no_trusted_origins: 'Belum ada sumber terpercaya.',
      trusted: 'Terpercaya',
      
      // Auth - Password
      enter_password: 'Masukkan Kata Sandi',
      enter_password_continue: 'Silakan masukkan kata sandi Anda untuk melanjutkan',
      password: 'Kata Sandi',
      password_min_chars: 'Kata sandi harus terdiri dari minimal 6 karakter',
      continue: 'Lanjutkan',
      forgot_password_link: 'Lupa kata sandi?',
      auth_failed_maybe_password: 'Autentikasi gagal, mungkin kata sandi salah?',
      auth_failed_try_again: 'Autentikasi gagal. Silakan coba lagi.',
      
      // Auth - OTP
      enter_verification_code: 'Masukkan Kode Verifikasi',
      enter_6_digit_code: 'Masukkan kode 6 digit yang dikirim ke telepon Anda',
      verify: 'Verifikasi',
      resend_code: 'Kirim ulang kode',
      invalid_code: 'Kode tidak valid',
      
      // Auth - Phone
      enter_phone_number: 'Masukkan Nomor Telepon',
      phone_number_required: 'Nomor telepon diperlukan untuk melanjutkan',
      phone_number: 'Nomor Telepon',
      send_verification_code: 'Kirim Kode Verifikasi',
      invalid_phone_number: 'Nomor telepon tidak valid',
    }
  }
};

// Define supported languages
const supportedLanguages = ['en', 'es', 'zh', 'hi', 'fr', 'ar', 'pt', 'bn', 'ru', 'id'];

// Validate and ensure we use a supported language
if (!supportedLanguages.includes(detectedLanguage)) {
  console.warn(`⚠️ Detected language "${detectedLanguage}" is not supported. Falling back to English.`);
  detectedLanguage = 'en';
}

console.log('🌍 Final language to use:', detectedLanguage);
console.log('📋 Supported languages:', supportedLanguages);

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectedLanguage, // Use the validated detected language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })
  .then(() => {
    console.log('✅ i18n initialized successfully');
    console.log('🌐 Current language set to:', i18n.language);
    console.log('📋 Available languages:', Object.keys(resources));
    console.log('🎯 Fallback language:', i18n.options.fallbackLng);
    
    // Test basic translation functionality
    const testKey = 'new_tab';
    const translation = i18n.t(testKey);
    console.log(`🧪 Test translation for "${testKey}":`, translation);
    
    if (translation === testKey) {
      console.warn('⚠️ Translation not working - returned key instead of translated text');
    } else {
      console.log('✅ Basic translation test passed');
    }
  })
  .catch((error) => {
    console.error('❌ i18n initialization failed:', error);
  });

interface LanguageContextType {
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  currentLanguage: 'en',
  setCurrentLanguage: () => {},
});

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  
  console.log('🔄 LanguageProvider initialized with language:', currentLanguage);
  
  const handleLanguageChange = (language: string) => {
    console.log('🔄 Language changing from', currentLanguage, 'to', language);
    setCurrentLanguage(language);
    i18n.changeLanguage(language).then(() => {
      console.log('✅ Language successfully changed to:', i18n.language);
    }).catch((error) => {
      console.error('❌ Failed to change language:', error);
    });
  };
  
  return (
    <LanguageContext.Provider value={{ currentLanguage, setCurrentLanguage: handleLanguageChange }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => useContext(LanguageContext);

export type TranslationKey = keyof typeof resources.en.translation;

// Test function to verify translations are working
export const testTranslations = () => {
  console.log('🧪 Testing translations...');
  console.log('Current language:', i18n.language);
  console.log('Test translation (new_tab):', i18n.t('new_tab'));
  console.log('Test translation (bookmarks):', i18n.t('bookmarks'));
  console.log('Test translation (settings):', i18n.t('settings'));
  
  // Test if the translation exists
  const testKey = 'new_tab';
  const translation = i18n.t(testKey);
  if (translation === testKey) {
    console.warn('⚠️ Translation not found for key:', testKey);
  } else {
    console.log('✅ Translation working correctly');
  }
};

// Advanced debug function to check language detection and translation state
export const debugLanguageDetection = () => {
  console.log('🔍 === LANGUAGE DETECTION DEBUG ===');
  
  try {
    // Check expo-localization first
    const Localization = require('expo-localization');
    const locales = Localization.getLocales();
    console.log('🌍 expo-localization locales:', locales);
    console.log('🔤 expo-localization language code:', locales?.[0]?.languageCode);
  } catch (e) {
    console.log('⚠️ expo-localization not available:', e.message);
  }
  
  try {
    // Check react-native-localize
    const { getLocales } = require('react-native-localize');
    const locales = getLocales();
    console.log('🌍 react-native-localize locales:', locales);
  } catch (e) {
    console.log('⚠️ react-native-localize not available');
  }
  
  try {
    // Check platform-specific settings
    const { Platform, NativeModules } = require('react-native');
    console.log('📱 Platform:', Platform.OS);
    
    if (Platform.OS === 'ios') {
      console.log('🍎 iOS SettingsManager:', NativeModules.SettingsManager?.settings);
      
      const { I18nManager } = require('react-native');
      console.log('🍎 iOS I18nManager:', {
        localeIdentifier: I18nManager.localeIdentifier,
        isRTL: I18nManager.isRTL
      });
    }
  } catch (e) {
    console.log('⚠️ Platform detection failed:', e.message);
  }
  
  // Current i18n state
  console.log('🎯 i18n current language:', i18n.language);
  console.log('📋 i18n available languages:', Object.keys(resources));
  console.log('🔙 i18n fallback language:', i18n.options.fallbackLng);
  
  // Test translations in current language
  const testKeys = ['new_tab', 'bookmarks', 'settings', 'search_placeholder'];
  testKeys.forEach(key => {
    const translation = i18n.t(key);
    console.log(`🧪 "${key}" -> "${translation}"`);
  });
  
  console.log('🔍 === END DEBUG ===');
};

// Manual test function to force language change for debugging
export const forceLanguage = (language: string) => {
  console.log('🔧 Manually forcing language change to:', language);
  return i18n.changeLanguage(language).then(() => {
    console.log('✅ Language manually changed to:', i18n.language);
    // Test a few translations
    console.log('🧪 Test "new_tab":', i18n.t('new_tab'));
    console.log('🧪 Test "bookmarks":', i18n.t('bookmarks'));
    console.log('🧪 Test "settings":', i18n.t('settings'));
    return i18n.language;
  }).catch((error) => {
    console.error('❌ Failed to manually change language:', error);
    throw error;
  });
};

// Global helper for quick Spanish test
(global as any).testSpanish = () => forceLanguage('es');
(global as any).testEnglish = () => forceLanguage('en');

export default i18n;

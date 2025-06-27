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
      
      // Wallet
      balance: 'Balance',
      send: 'Send',
      receive: 'Receive',
      wallet: 'Wallet',
      identity: 'Identity',
      
      // Settings
      settings: 'Settings',
      theme: 'Theme',
      currency_format: 'Currency Format',
      language: 'Language',
      
      // Notifications
      notification_permission: 'Notification Permission',
      allow_notifications: 'Allow notifications from this site?',
      allow: 'Allow',
      block: 'Block',
      
      // Errors
      error_loading_page: 'Error loading page',
      no_internet: 'No internet connection',
      invalid_url: 'Invalid URL',
      something_went_wrong: 'Something went wrong',
      
      // States
      loading: 'Loading...',
      no_results: 'No results found',
      empty: 'Empty',
      
      // Units
      satoshis: 'satoshis',
      sats: 'sats',
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
      
      // States
      loading: '加载中...',
      no_results: '未找到结果',
      empty: '空',
      
      // Units
      satoshis: '聪',
      sats: '聪',
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

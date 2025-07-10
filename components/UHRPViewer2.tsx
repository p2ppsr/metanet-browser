import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Share,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/theme/ThemeContext';
import { uhrpHandler, UHRPResolvedContent, UHRPError } from '@/utils/uhrpProtocol';

interface UHRPViewerProps {
  url: string;
  onBack?: () => void;
  onError?: (error: UHRPError) => void;
}

const UHRPViewer: React.FC<UHRPViewerProps> = ({ url, onBack, onError }) => {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<UHRPResolvedContent | null>(null);
  const [error, setError] = useState<UHRPError | null>(null);
  
  const { colors, isDark } = useTheme();

  useEffect(() => {
    loadContent();
  }, [url]);

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    setContent(null);

    try {
      const resolvedContent = await uhrpHandler.resolveUHRPUrl(url);
      setContent(resolvedContent);
      console.log('UHRP content loaded successfully:', {
        mimeType: resolvedContent.mimeType,
        size: resolvedContent.size,
        resolvedUrl: resolvedContent.resolvedUrl
      });
    } catch (err) {
      const uhrpError = err as UHRPError;
      setError(uhrpError);
      onError?.(uhrpError);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!content) return;

    try {
      await Share.share({
        title: 'UHRP Content',
        message: `Check out this UHRP content: ${url}`,
        url: content.resolvedUrl || url,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleRetry = () => {
    loadContent();
  };

  const renderContent = () => {
    if (!content) return null;

    const { mimeType, resolvedUrl } = content;

    // For images, we can use the resolved HTTP URL directly in WebView
    if (mimeType.startsWith('image/')) {
      return (
        <WebView
          source={{ uri: resolvedUrl! }}
          style={styles.webview}
          scalesPageToFit
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onLoadEnd={() => console.log('Image loaded successfully')}
          onError={(error) => console.error('WebView error loading image:', error)}
        />
      );
    }

    // For PDFs, use the resolved HTTP URL
    if (mimeType === 'application/pdf') {
      return (
        <WebView
          source={{ uri: resolvedUrl! }}
          style={styles.webview}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading PDF...</Text>
            </View>
          )}
          onLoadEnd={() => console.log('PDF loaded successfully')}
          onError={(error) => console.error('WebView error loading PDF:', error)}
        />
      );
    }

    // For text content, display in a ScrollView
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      const textContent = new TextDecoder().decode(content.content);
      return (
        <ScrollView style={[styles.textContainer, { backgroundColor: colors.paperBackground }]}>
          <Text style={[styles.textStyle, { color: colors.textPrimary }]}>
            {textContent}
          </Text>
        </ScrollView>
      );
    }

    // For videos and audio, try using WebView with the resolved URL
    if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
      return (
        <WebView
          source={{ uri: resolvedUrl! }}
          style={styles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onLoadEnd={() => console.log('Media loaded successfully')}
          onError={(error) => console.error('WebView error loading media:', error)}
        />
      );
    }

    // For other file types, show info and download option
    return (
      <View style={[styles.fileInfoContainer, { backgroundColor: colors.paperBackground }]}>
        <Ionicons name="document" size={64} color={colors.textSecondary} />
        <Text style={[styles.fileName, { color: colors.textPrimary }]}>
          Content Available
        </Text>
        <Text style={[styles.fileInfo, { color: colors.textSecondary }]}>
          Type: {mimeType}
        </Text>
        <Text style={[styles.fileInfo, { color: colors.textSecondary }]}>
          Size: {(content.size / 1024).toFixed(2)} KB
        </Text>
        {resolvedUrl && (
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={handleShare}>
            <Ionicons name="share" size={20} color={colors.buttonText} />
            <Text style={[styles.actionButtonText, { color: colors.buttonText }]}>Share</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.paperBackground, borderBottomColor: colors.inputBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            UHRP Content
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {url}
          </Text>
        </View>
        
        {content && (
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Ionicons name="share-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {loading && (
          <View style={[styles.loadingContainer, { backgroundColor: colors.paperBackground }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Resolving UHRP content...
            </Text>
            <Text style={[styles.loadingSubtext, { color: colors.textSecondary }]}>
              This may take a moment
            </Text>
          </View>
        )}

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.paperBackground }]}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
            <Text style={[styles.errorTitle, { color: colors.error }]}>
              Failed to Load Content
            </Text>
            <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
              {error.message}
            </Text>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleRetry}
            >
              <Text style={[styles.actionButtonText, { color: colors.buttonText }]}>
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {content && !loading && !error && renderContent()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  shareButton: {
    marginLeft: 12,
  },
  contentContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  fileInfoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  fileName: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  fileInfo: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  webview: {
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  textStyle: {
    fontSize: 14,
    lineHeight: 20,
    padding: 16,
    fontFamily: 'monospace',
  },
});

export default UHRPViewer;

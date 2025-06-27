import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

interface Web3BenefitsModalProps {
  visible: boolean;
  onDismiss: () => void;
  onContinueWithoutLogin: () => void;
  onGoToLogin: () => void;
}

const Web3BenefitsModal: React.FC<Web3BenefitsModalProps> = ({
  visible,
  onDismiss,
  onContinueWithoutLogin,
  onGoToLogin,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const benefits = [
    {
      icon: 'key-outline' as const,
      title: 'Never login again',
      description: 'One identity for every Web3 app. No more passwords or sign-ups.',
    },
    {
      icon: 'flash-outline' as const,
      title: 'Instant everything',
      description: 'Payments, access, verification - all happen in seconds.',
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'You own your data',
      description: 'No companies tracking you or selling your information.',
    },
    {
      icon: 'planet-outline' as const,
      title: 'Works everywhere',
      description: 'Access thousands of Web3 apps with the same identity.',
    },
    {
      icon: 'trending-up-outline' as const,
      title: 'Future-proof',
      description: 'Be early to the next generation of the internet.',
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              🚀 Welcome to the Future
            </Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <Text style={[styles.subtitle, { color: colors.textPrimary }]}>
              🎯 <Text style={{ fontWeight: 'bold', color: colors.primary }}>Here's what you'll unlock with Web3:</Text>
            </Text>

            <View style={styles.benefitsContainer}>
              {benefits.map((benefit, index) => (
                <View key={index} style={[styles.benefitItem, { 
                  backgroundColor: colors.primary + '08',
                  borderLeftColor: colors.primary,
                }]}>
                  <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                    <Ionicons name={benefit.icon} size={22} color="#FFFFFF" />
                  </View>
                  <View style={styles.benefitText}>
                    <Text style={[styles.benefitTitle, { color: colors.textPrimary }]}>
                      {benefit.title}
                    </Text>
                    <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>
                      {benefit.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.highlightBox, { 
              backgroundColor: colors.primary + '15', 
              borderColor: colors.primary,
            }]}>
              <Text style={[styles.highlightText, { color: colors.textPrimary }]}>
                ⚡ <Text style={{ fontWeight: '800', color: colors.primary }}>Ready in 30 seconds!</Text> Your Web3 identity works everywhere instantly. 
                Join millions already using the future of the internet.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={onGoToLogin}
            >
              <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
                � Get My Web3 Identity (30s)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onContinueWithoutLogin}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                Maybe later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderRadius: 20,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 17,
    marginBottom: 24,
    lineHeight: 24,
    fontWeight: '600',
  },
  benefitsContainer: {
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start',
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  highlightBox: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 20,
  },
  highlightText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 10,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    fontSize: 11,
    fontWeight: '300',
    opacity: 0.5,
  },
});

export default Web3BenefitsModal;

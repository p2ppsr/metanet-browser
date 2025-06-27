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
      title: 'Never Login Again',
      description: 'Your identity follows you everywhere. No more passwords, usernames, or forgotten credentials across Web3 apps.',
    },
    {
      icon: 'wallet-outline' as const,
      title: 'Instant Payments',
      description: 'Send and receive payments instantly to anyone, anywhere. No banks, no delays, no hefty fees.',
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Own Your Data',
      description: 'Your personal information stays with you. No corporations harvesting and selling your data.',
    },
    {
      icon: 'flash-outline' as const,
      title: 'Lightning Fast',
      description: 'Experience the web at the speed of thought. Web3 apps load instantly with your identity ready.',
    },
    {
      icon: 'globe-outline' as const,
      title: 'Universal Access',
      description: 'One identity works across all Web3 platforms. Travel the decentralized web seamlessly.',
    },
    {
      icon: 'trending-up-outline' as const,
      title: 'Future-Proof',
      description: 'Join the next generation of the internet. Be part of the revolution before everyone else.',
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
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You're about to experience Web3 - but why not unlock its full power?
            </Text>

            <View style={styles.benefitsContainer}>
              {benefits.map((benefit, index) => (
                <View key={index} style={[styles.benefitItem, { borderColor: colors.inputBorder }]}>
                  <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name={benefit.icon} size={24} color={colors.primary} />
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

            <View style={[styles.highlightBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
              <Text style={[styles.highlightText, { color: colors.textPrimary }]}>
                ✨ <Text style={{ fontWeight: 'bold' }}>Pro Tip:</Text> Setting up your Web3 identity takes just 30 seconds and works forever. 
                It's like getting a universal key to the entire decentralized internet!
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
                🔑 Get My Web3 Identity (30s)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.inputBorder }]}
              onPress={onContinueWithoutLogin}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                Continue without Web3 (limited experience)
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
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  benefitsContainer: {
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  highlightBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  highlightText: {
    fontSize: 14,
    lineHeight: 20,
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
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default Web3BenefitsModal;

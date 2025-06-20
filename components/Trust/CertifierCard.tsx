import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/theme/ThemeContext';
import Slider from '@react-native-community/slider';
import * as Clipboard from 'expo-clipboard';
import { Permission } from './TrustDetail';

export type Certifier = {
  id: string;
  name: string;
  domain: string;
  icon?: string;
  description?: string;
  verified?: boolean;
  trustLevel: number;
  maxTrust: number;
  fullKey: string;
  permissions: Permission[];
};

type Props = {
  cert: Certifier;
  onChangeTrust: (id: string, value: number) => void;
  onRemove: (id: string) => void;
};

const CertifierCard: React.FC<Props> = ({ cert, onChangeTrust, onRemove }) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={[styles.card, { borderColor: colors.inputBorder, backgroundColor: colors.paperBackground }]}>      
      <TouchableOpacity style={styles.row} onPress={toggle} activeOpacity={0.8}>
        {cert.icon ? (
          <Image source={{ uri: cert.icon }} style={styles.icon} />
        ) : (
          <View style={[styles.placeholderIcon, { backgroundColor: colors.primary }]}>
            <Text style={{ color: colors.background, fontWeight: '700' }}>{cert.name[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{cert.name}{cert.verified && ' ✅'}</Text>
          {cert.description && (
            <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={1}>{cert.description}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => onRemove(cert.id)} style={{ padding: 4 }} accessibilityRole="button" accessibilityLabel={`Remove ${cert.name}`}>
          <Ionicons name="close" size={18} color={colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>

      {expanded && (
        <>
          <View style={styles.keyRow}>
            <Text style={[styles.fullKey, { color: colors.textSecondary, flex:1 }]} numberOfLines={1} ellipsizeMode="middle">{cert.fullKey}</Text>
            <TouchableOpacity onPress={() => Clipboard.setStringAsync(cert.fullKey)} accessibilityLabel="Copy identity key" style={{ paddingHorizontal:4 }}>
              <Ionicons name="copy" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>Trust Level: {cert.trustLevel}/{cert.maxTrust}</Text>
          <Slider
            minimumValue={0}
            maximumValue={cert.maxTrust}
            step={1}
            value={cert.trustLevel}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.inputBorder}
            onSlidingComplete={v => onChangeTrust(cert.id, v)}
          />
        </>
      )}
    </View>
  );
};

export default CertifierCard;

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 28, height: 28, borderRadius: 6, marginRight: 12 },
  placeholderIcon: { width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  name: { fontSize: 14, fontWeight: '600' },
  desc: { fontSize: 12 },
  fullKey: { fontSize: 10, marginTop: 8 },
  keyRow: { flexDirection: 'row', alignItems: 'center', marginTop:8 },
  sliderLabel: { fontSize: 12, marginTop: 12 }
}); 
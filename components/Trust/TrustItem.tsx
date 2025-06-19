import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/theme/ThemeContext';

type Props = {
  item: {
    id: string;
    name: string;
    domain: string;
    icon?: string;
    added: string;
  };
  onPress: (id: string) => void;
  onRevoke: (id: string) => void;
};

const TrustItem: React.FC<Props> = ({ item, onPress, onRevoke }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Trusted origin ${item.name}`}
      onPress={() => onPress(item.id)}
      style={[styles.card, { borderColor: colors.inputBorder, backgroundColor: colors.paperBackground }]}
    >
      {item.icon ? (
        <Image source={{ uri: item.icon }} style={styles.icon} />
      ) : (
        <View style={[styles.placeholderIcon, { backgroundColor: colors.primary }]}>          
          <Text style={{ color: colors.background, fontWeight: '700' }}>{item.name[0]}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.itemDomain, { color: colors.textSecondary }]} numberOfLines={1}>{item.domain}</Text>
        <Text style={[styles.itemAdded, { color: colors.textSecondary }]}>Trusted {item.added}</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Revoke trust for ${item.name}`}
        onPress={() => onRevoke(item.id)}
      >
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default TrustItem;

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 12 },
  icon: { width: 32, height: 32, borderRadius: 6, marginRight: 12 },
  placeholderIcon: { width: 32, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemName: { fontSize: 16, fontWeight: '600' },
  itemDomain: { fontSize: 12 },
  itemAdded: { fontSize: 10 }
}); 
import React, { useRef } from 'react'
import {
  FlatList,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  LayoutAnimation
} from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { useTheme } from '@/context/theme/ThemeContext'

export interface HistoryEntry {
  title: string
  url: string
  timestamp: number
}

interface Props {
  history: HistoryEntry[]
  onSelect: (url: string) => void
  onDelete: (url: string) => void
  onClear: () => void
}

export const HistoryList = ({
  history,
  onSelect,
  onDelete,
  onClear
}: Props) => {
  const { colors } = useTheme()
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map())

  const handleClear = () => {
    // Close all swipeable items before clearing
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    swipeableRefs.current.forEach(swipeable => {
      try {
        swipeable?.close()
      } catch (error) {
        // Ignore errors when closing swipeables
      }
    })
    
    // Clear the refs map
    swipeableRefs.current.clear()
    
    // Call the onClear callback
    setTimeout(() => {
      onClear()
    }, 100) // Small delay to let animations finish
  }

  const handleDelete = (url: string) => {
    // Close the specific swipeable before deleting
    const swipeable = swipeableRefs.current.get(url)
    if (swipeable) {
      try {
        swipeable.close()
      } catch (error) {
        // Ignore errors
      }
      swipeableRefs.current.delete(url)
    }
    onDelete(url)
  }
  const renderItem = ({ item }: { item: HistoryEntry }) => (
    <Swipeable
      ref={(ref) => {
        if (ref) {
          swipeableRefs.current.set(item.url, ref)
        }
      }}
      overshootRight={false}
      renderRightActions={() => (
        <View style={[styles.swipeDelete, { backgroundColor: '#ff3b30' }]}>
          <Text style={styles.swipeDeleteText}>✕</Text>
        </View>
      )}
      onSwipeableRightOpen={() => handleDelete(item.url)}
    >
      <Pressable style={styles.historyItem} onPress={() => onSelect(item.url)}>
        <Text
          numberOfLines={1}
          style={{ color: colors.textPrimary, fontSize: 15 }}
        >
          {item.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: colors.textSecondary, fontSize: 12 }}
        >
          {item.url}
        </Text>
      </Pressable>
    </Swipeable>
  )
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={history}
        keyExtractor={i => i.url + i.timestamp}
        renderItem={renderItem}
        ListFooterComponent={<View style={{ height: 80 }} />}
        removeClippedSubviews={false}
      />
      <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
        <Text style={styles.clearBtnIcon}>🗑️</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  historyItem: { padding: 12 },
  clearBtn: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6
  },
  clearBtnIcon: { color: '#fff', fontSize: 22 },
  swipeDelete: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    marginVertical: 10,
    borderRadius: 10
  },
  swipeDeleteText: { color: '#fff', fontSize: 24 }
})

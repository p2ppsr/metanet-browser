// src/features/bookmarks/components/BookmarkTabs.tsx

import React, { useCallback, useRef } from 'react'
import {
  FlatList,
  StyleSheet,
  View,
  Animated,
  PanResponder
} from 'react-native'
import { Text } from 'react-native-paper'
import bookmarkStore from '@/components/BookmarkStore'

type BookmarkTabProps = {
  id: string
  title: string
  onDismiss: (id: string) => void
}

const SwipeableTab = ({ id, title, onDismiss }: BookmarkTabProps) => {
  const translateX = useRef(new Animated.Value(0)).current
  const dismissed = useRef(false)

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10
      },
      onPanResponderMove: (_, gestureState) => {
        if (!dismissed.current) {
          translateX.setValue(gestureState.dx)
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -120) {
          // Animate off-screen
          dismissed.current = true
          Animated.timing(translateX, {
            toValue: -500,
            duration: 200,
            useNativeDriver: true
          }).start(() => {
            onDismiss(id)
          })
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true
          }).start()
        }
      }
    })
  ).current

  return (
    <Animated.View
      style={[styles.tab, { transform: [{ translateX }] }]}
      {...panResponder.panHandlers}
    >
      <Text style={styles.text}>{title}</Text>
    </Animated.View>
  )
}

export const BookmarkTabs = () => {
  const store = bookmarkStore

  const renderItem = useCallback(
    ({ item }: { item: { id: string; title: string } }) => (
      <SwipeableTab id={item.id} title={item.title} onDismiss={removeTab} />
    ),
    [removeTab]
  )

  return (
    <FlatList
      data={tabs}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.container}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16
  },
  tab: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12
  },
  text: {
    color: '#fff',
    fontSize: 16
  }
})

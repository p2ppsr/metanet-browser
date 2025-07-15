import React, { useRef } from 'react'
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler'

interface TabItemProps {
  tab: { title: string; id: string }
  onDelete: (id: string) => void
}

const SCREEN_WIDTH = Dimensions.get('window').width
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3

const TabItem = ({ tab, onDelete }: TabItemProps) => {
  const translateX = useRef(new Animated.Value(0)).current

  const handleGestureEvent = Animated.event([{ nativeEvent: { translationX: translateX } }], { useNativeDriver: true })

  const handleGestureEnd = ({ nativeEvent }: any) => {
    if (nativeEvent.translationX < -SWIPE_THRESHOLD) {
      Animated.timing(translateX, {
        toValue: -SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true
      }).start(() => onDelete(tab.id))
    } else {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true
      }).start()
    }
  }

  return (
    <GestureHandlerRootView>
      <PanGestureHandler onGestureEvent={handleGestureEvent} onEnded={handleGestureEnd}>
        <Animated.View style={[styles.container, { transform: [{ translateX }] }]}>
          <Text style={styles.text}>{tab.title}</Text>
        </Animated.View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111',
    padding: 20,
    marginVertical: 10,
    borderRadius: 10
  },
  text: {
    color: '#fff',
    fontSize: 16
  }
})

export default TabItem

import React from 'react'
import { View } from 'react-native'
import { ToolbarButton } from './ToolbarButton'

interface BottomToolbarProps {
  navBack: () => void
  navFwd: () => void
  shareCurrent: () => void
  toggleStarDrawer: (show: boolean) => void
  setShowTabsView: (show: boolean) => void
  activeTabUrl: string
  canGoBack: boolean
  canGoForward: boolean
  colors: any
  insets: { bottom: number }
  kNEW_TAB_URL: string
}

export const BottomToolbar = ({
  navBack,
  navFwd,
  shareCurrent,
  toggleStarDrawer,
  setShowTabsView,
  activeTabUrl,
  canGoBack,
  canGoForward,
  colors,
  insets,
  kNEW_TAB_URL
}: BottomToolbarProps) => (
  <View
    style={{
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 6,
      paddingBottom: insets.bottom,
      backgroundColor: colors.inputBackground,
      borderTopWidth: 0.5,
      borderTopColor: colors.inputBorder
    }}
  >
    <ToolbarButton icon="←" onPress={navBack} disabled={!canGoBack} />
    <ToolbarButton icon="→" onPress={navFwd} disabled={!canGoForward} />
    <ToolbarButton
      icon="⇪"
      onPress={shareCurrent}
      disabled={activeTabUrl === kNEW_TAB_URL}
    />
    <ToolbarButton icon="★" onPress={() => toggleStarDrawer(true)} />
    <ToolbarButton icon="▒" onPress={() => setShowTabsView(true)} />
  </View>
)

// components/BookmarkTabs.tsx
import React from 'react'
import { View, Text, Button, StyleSheet, TouchableOpacity } from 'react-native'
import { observer } from 'mobx-react-lite'
import tabStore from '@/stores/TabStore'

const BookmarkTabs = observer(() => {
  const { tabs, activeTabId, setActiveTab } = tabStore

  return (
    <View style={styles.container}>
      {tabs.map(tab => (
        <View
          key={tab.id}
          style={[
            styles.tab,
            { backgroundColor: tab.id === activeTabId ? '#333' : '#1f1f1f' }
          ]}
        >
          <TouchableOpacity
            style={styles.tabContent}
            onPress={() => setActiveTab(tab.id)}
            accessibilityLabel={`Select tab: ${tab.title || 'Untitled'}`}
          >
            <Text style={styles.title}>{tab.title || 'Untitled'}</Text>
            {tab.isLoading && <Text style={styles.loading}>Loading...</Text>}
          </TouchableOpacity>
          <Button
            title="Close"
            accessibilityLabel={`Close tab: ${tab.title || 'Untitled'}`}
          />
        </View>
      ))}
    </View>
  )
})

export default BookmarkTabs

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  tab: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  tabContent: {
    flex: 1,
    paddingRight: 8
  },
  title: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 4
  },
  loading: {
    color: '#999',
    fontSize: 12
  }
})

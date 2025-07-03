import React, { useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import TabItem from './TabItem'

const TabsScreen = () => {
  const [tabs, setTabs] = useState([
    { id: '1', title: 'Home' },
    { id: '2', title: 'Docs' },
    { id: '3', title: 'Settings' }
  ])

  const handleDelete = (id: string) => {
    setTabs(prev => prev.filter(tab => tab.id !== id))
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tabs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TabItem tab={item} onDelete={handleDelete} />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 10
  }
})

export default TabsScreen

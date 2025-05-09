import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <Text style={styles.text}>
      blank
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 50,
    color: '#333',
    textAlign: 'center',
    marginTop: 100,
  },
});
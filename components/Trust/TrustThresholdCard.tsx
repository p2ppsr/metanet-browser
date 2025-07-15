import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'
import { useTheme } from '@/context/theme/ThemeContext'

interface Props {
  totalPoints: number // total points the user has distributed
  threshold: number // current minimum threshold
  maxPoints?: number // optional upper bound (defaults to totalPoints)
  onChange: (value: number) => void
}

const TrustThresholdCard: React.FC<Props> = ({ totalPoints, threshold, onChange, maxPoints = totalPoints }) => {
  const { colors } = useTheme()
  const [localValue, setLocalValue] = useState(threshold)

  return (
    <View style={[styles.card, { borderColor: colors.inputBorder, backgroundColor: colors.paperBackground }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Trust Threshold</Text>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>
        You have given {totalPoints} total points. Choose the minimum points a counter-party must have across your
        network.
      </Text>
      <Text style={[styles.valueText, { color: colors.textPrimary }]}>
        {localValue} / {maxPoints}
      </Text>
      <Slider
        minimumValue={0}
        maximumValue={maxPoints}
        step={1}
        value={localValue}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.inputBorder}
        onValueChange={setLocalValue}
        onSlidingComplete={onChange}
      />
    </View>
  )
}

export default TrustThresholdCard

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderRadius: 8, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  caption: { fontSize: 12, marginBottom: 12 },
  valueText: { fontSize: 12, alignSelf: 'flex-end', marginBottom: 4 }
})

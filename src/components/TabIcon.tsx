import { StyleSheet, Text, type ColorValue } from 'react-native';

type TabIconProps = {
  symbol: string;
  color: ColorValue;
};

export function TabIcon({ symbol, color }: TabIconProps) {
  return <Text style={[styles.icon, { color }]}>{symbol}</Text>;
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 18,
    lineHeight: 22,
  },
});

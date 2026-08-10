import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

type TabIconProps = {
  name: ComponentProps<typeof Ionicons>['name'];
  color: ColorValue;
  focused?: boolean;
};

export function TabIcon({ name, color, focused = false }: TabIconProps) {
  return <Ionicons color={color} name={name} size={focused ? 23 : 22} />;
}

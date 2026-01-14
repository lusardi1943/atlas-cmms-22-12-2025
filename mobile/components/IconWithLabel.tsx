import { IconSource } from 'react-native-paper/lib/typescript/components/Icon';
import { StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import * as React from 'react';

export function IconWithLabel({
  icon,
  label,
  color,
  labelVariant = 'bodyMedium',
  iconSize = 25
}: {
  icon: IconSource;
  label: string;
  color?: string;
  labelVariant?: React.ComponentProps<typeof Text>['variant'];
  iconSize?: number;
}) {
  return (
    <View style={{ ...styles.row, justifyContent: 'flex-start' }}>
      <Icon source={icon} size={iconSize} color={color} />
      <Text style={{ color, flexShrink: 1 }} variant={labelVariant}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  }
});

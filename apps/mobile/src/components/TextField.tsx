import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';

interface TextFieldProps extends TextInputProps {
  valid?: boolean;
}

export function TextField({ valid, style, ...props }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.wrap,
        focused && styles.focused,
        valid && styles.valid,
      ]}
    >
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  focused: { borderColor: colors.pink },
  valid: { borderColor: colors.purple },
  input: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 14,
  },
});

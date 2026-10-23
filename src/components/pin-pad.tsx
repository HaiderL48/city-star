import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { colors, fonts } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export function PinPad({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const press = (key: string) => {
    if (key === 'C') onChange('');
    else if (key === '⌫') onChange(value.slice(0, -1));
    else if (value.length < 6) onChange(`${value}${key}`);
  };

  return (
    <View style={styles.wrap}>
      <T weight="bold" style={styles.dots}>
        {value ? '●'.repeat(value.length) : '–'}
      </T>
      <View style={styles.grid}>
        {KEYS.map((key) => (
          <Pressable key={key} onPress={() => press(key)} style={({ pressed }) => [styles.key, pressed && styles.pressed]}>
            {key === '⌫' ? <Ionicons name="backspace-outline" size={22} color={colors.ink} /> : <T weight="semi" style={styles.keyText}>{key}</T>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, alignItems: 'center' },
  dots: { fontSize: 22, letterSpacing: 6, minHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 276, gap: 10 },
  key: {
    width: 84,
    height: 58,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 22, fontFamily: fonts.semi },
  pressed: { backgroundColor: colors.greenSoft },
});

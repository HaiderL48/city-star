import { StyleSheet, View } from 'react-native';

import { T } from '@/components/ui';
import { useSession } from '@/state/session';
import { colors } from '@/theme';

export default function Boot() {
  const { error } = useSession();
  return (
    <View style={styles.screen}>
      <T weight="bold" style={styles.title}>
        City Star
      </T>
      <T style={styles.sub}>દુકાનનો હિસાબ</T>
      <T style={styles.sub}>Shop books</T>
      {error ? (
        <T style={styles.error}>
          {error.includes('Access Handle') || error.includes('Invalid VFS')
            ? 'Close other City Star windows, then reload.'
            : error}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { color: colors.white, fontSize: 40 },
  sub: { color: '#E7F6EE', fontSize: 16 },
  error: { color: '#FFE8A3', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});

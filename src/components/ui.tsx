import { Ionicons } from '@expo/vector-icons';
import { forwardRef, type ReactNode } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { saveSettings } from '@/db';
import type { BillStatus, PayMode } from '@/db/types';
import type { Key } from '@/i18n';
import { useI18n } from '@/i18n';
import { useSession } from '@/state/session';
import { colors, fonts } from '@/theme';

type Weight = 'regular' | 'semi' | 'bold';

export function T({
  children,
  weight = 'regular',
  style,
  numberOfLines,
}: {
  children?: ReactNode;
  weight?: Weight;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const family = weight === 'bold' ? fonts.bold : weight === 'semi' ? fonts.semi : fonts.regular;
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: family, color: colors.ink }, style]}>
      {children}
    </Text>
  );
}

export function Screen({
  children,
  scroll = false,
  pad = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  pad?: boolean;
}) {
  if (scroll) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.scroll, !pad && styles.noPad]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.screen, pad && styles.pad]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const background = kind === 'primary' ? colors.green : kind === 'danger' ? colors.red : kind === 'ghost' ? 'transparent' : colors.white;
  const color = kind === 'secondary' || kind === 'ghost' ? colors.greenDark : colors.white;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: kind === 'secondary' || kind === 'ghost' ? colors.line : background },
        kind === 'secondary' && styles.secondary,
        (pressed || disabled) && styles.pressed,
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <T weight="semi" style={{ color, fontSize: 16 }}>
        {label}
      </T>
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <T weight="semi" style={styles.label}>
        {label}
      </T>
      <TextInput placeholderTextColor="#8A978F" {...props} style={[styles.input, props.style]} />
    </View>
  );
}

export function Choice({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const on = option.id === value;
        return (
          <Pressable key={option.id} onPress={() => onChange(option.id)} style={[styles.choice, on && styles.choiceOn]}>
            <T weight="semi" style={{ color: on ? colors.greenDark : colors.muted, fontSize: 14 }}>
              {option.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pill({ status }: { status: BillStatus }) {
  const { t } = useI18n();
  const tone =
    status === 'paid' ? styles.good : status === 'partial' ? styles.warn : status === 'returned' ? styles.mute : styles.bad;
  const key = status === 'paid' ? 'statusPaid' : status === 'partial' ? 'statusPartial' : status === 'returned' ? 'statusReturned' : 'statusUnpaid';
  return (
    <View style={[styles.pill, tone]}>
      <T weight="semi" style={styles.pillText}>
        {t(key)}
      </T>
    </View>
  );
}

export function Money({ value, style }: { value: string; style?: StyleProp<TextStyle> }) {
  return (
    <T weight="bold" style={style}>
      {value}
    </T>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <T weight="semi" style={styles.emptyTitle}>
        {title}
      </T>
      {body ? <T style={styles.muted}>{body}</T> : null}
      {action}
    </View>
  );
}

export function Section({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <T weight="bold" style={styles.sectionTitle}>
        {title}
      </T>
      {action}
    </View>
  );
}

export function Dock({ children, safe = false }: { children: ReactNode; safe?: boolean }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.dock, { paddingBottom: safe ? Math.max(insets.bottom, 12) : 12 }]}>{children}</View>;
}

export function MenuRow({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menu, pressed && styles.pressed]}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={20} color={colors.greenDark} />
      </View>
      <View style={styles.menuBody}>
        <T weight="semi">{title}</T>
        {detail ? (
          <T style={styles.muted} numberOfLines={1}>
            {detail}
          </T>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  const { settings, reload } = useSession();
  const pick = async (next: 'en' | 'gu') => {
    await setLang(next);
    if (settings?.setupDone) {
      await saveSettings({ language: next });
      await reload();
    }
  };
  return (
    <View style={styles.lang}>
      <Pressable onPress={() => pick('en')} style={[styles.langBtn, lang === 'en' && styles.langOn]}>
        <T weight="semi" style={{ color: lang === 'en' ? colors.white : colors.greenDark, fontSize: 13 }}>
          EN
        </T>
      </Pressable>
      <Pressable onPress={() => pick('gu')} style={[styles.langBtn, lang === 'gu' && styles.langOn]}>
        <T weight="semi" style={{ color: lang === 'gu' ? colors.white : colors.greenDark, fontSize: 13 }}>
          ગુ
        </T>
      </Pressable>
      <T style={styles.sr}>{t('language')}</T>
    </View>
  );
}

export function confirm(title: string, message: string, ok: string, cancel: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function modeLabel(mode: PayMode | string, t: (key: Key) => string) {
  if (mode === 'cash') return t('cash');
  if (mode === 'upi') return t('upi');
  if (mode === 'card') return t('card');
  if (mode === 'credit') return t('credit');
  return mode;
}

export const ReceiptCard = forwardRef<View, { model: import('@/print/share').ReceiptModel; width: number }>(function ReceiptCard(
  { model, width },
  ref,
) {
  return (
    <View ref={ref} collapsable={false} style={[styles.receipt, { width }]}>
      <T weight="bold" style={styles.receiptShop}>
        {model.shopName}
      </T>
      {[model.address, model.phone, model.gstin].filter(Boolean).map((line) => (
        <T key={line} style={styles.receiptMeta}>
          {line}
        </T>
      ))}
      <T style={styles.dashes}>--------------------------------</T>
      <T weight="semi" style={styles.receiptMeta}>
        {model.number}
      </T>
      <T style={styles.receiptMeta}>{model.date}</T>
      <T weight="semi">{model.party}</T>
      <T style={styles.dashes}>--------------------------------</T>
      {model.lines.map((line, index) => (
        <View key={`${line.name}-${index}`} style={styles.receiptLine}>
          <T weight="semi">{line.name}</T>
          <View style={styles.receiptAmt}>
            <T style={styles.receiptMeta}>{line.detail}</T>
            <T weight="semi">{line.amount}</T>
          </View>
        </View>
      ))}
      <T style={styles.dashes}>--------------------------------</T>
      {model.rows.map((row) => (
        <View key={row.label} style={styles.receiptAmt}>
          <T style={styles.receiptMeta}>{row.label}</T>
          <T>{row.value}</T>
        </View>
      ))}
      <View style={styles.receiptAmt}>
        <T weight="bold">{model.totalLabel}</T>
        <T weight="bold" style={{ fontSize: 18 }}>
          {model.total}
        </T>
      </View>
      <T weight="semi" style={styles.thanks}>
        {model.thanks}
      </T>
      <T style={styles.receiptMeta}>{model.footer}</T>
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 16 },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  noPad: { padding: 0 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 8,
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  secondary: { backgroundColor: colors.white },
  pressed: { opacity: 0.72 },
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 13 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  choiceOn: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 12 },
  good: { backgroundColor: colors.greenSoft },
  warn: { backgroundColor: colors.goldSoft },
  bad: { backgroundColor: colors.redSoft },
  mute: { backgroundColor: colors.bg },
  empty: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16 },
  muted: { color: colors.muted, fontSize: 13 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { fontSize: 18 },
  dock: {
    padding: 12,
    gap: 8,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  menu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBody: { flex: 1, gap: 2 },
  lang: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: 3 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  langOn: { backgroundColor: colors.greenDark },
  sr: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
  receipt: { backgroundColor: colors.white, padding: 16, gap: 2 },
  receiptShop: { fontSize: 20, textAlign: 'center' },
  receiptMeta: { color: '#333', fontSize: 12, textAlign: 'center' },
  dashes: { color: '#222', fontSize: 12, textAlign: 'center' },
  receiptLine: { marginTop: 6, gap: 2 },
  receiptAmt: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  thanks: { textAlign: 'center', marginTop: 10 },
});

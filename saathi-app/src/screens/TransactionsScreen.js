import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, typography } from '../theme';
import { getTransactions } from '../services/personBClient.js';
import { relativeDate } from '../services/viewModels.js';
import { useLiveData } from '../hooks/useLiveData';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const OUT = ['expense', 'commitment'];

// Every income / expense / saving Person B has recorded (Chat, WhatsApp). Business Khata entries live in their own tab.
export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { status, data, error, reload } = useLiveData(getTransactions);
  const list = (data && data.transactions) || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t('transactions.headerTitle')}</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {status === 'loading' && (
          <View style={styles.stateCenter}>
            <ActivityIndicator size="large" color={colors.forestInk} />
          </View>
        )}
        {status === 'error' && (
          <View style={styles.errorBox} accessibilityRole="alert">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="alert-circle" size={18} color={colors.warningText} />
              <Text style={styles.errorTitle}>{t('transactions.couldNotLoad')}</Text>
            </View>
            <Text style={styles.errorSub}>{error && error.message}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={reload}>
              <Text style={styles.retryBtnText}>{t('common.tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {status === 'live' && list.length === 0 && (
          <View style={styles.stateCenter}>
            <Ionicons name="receipt-outline" size={32} color={colors.textTertiary} style={{ marginBottom: 8 }} />
            <Text style={styles.emptyText}>{t('transactions.noTransactions')}</Text>
          </View>
        )}
        {list.map((tx) => {
          const out = OUT.includes(tx.tx_type);
          return (
            <View key={tx.id} style={styles.row}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name={out ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
                  size={20}
                  color={out ? colors.errorText : colors.forestInk}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{tx.raw_text || tx.category}</Text>
                <Text style={styles.rowMeta}>
                  {t(`transactions.type.${tx.tx_type}`, { defaultValue: tx.tx_type })} • {tx.category} • {tx.target_pot} pot • {relativeDate(tx.created_at)}
                </Text>
              </View>
              <Text style={[styles.amount, { color: out ? colors.errorText : colors.forestInk }]}>
                {out ? '−' : '+'}{money(tx.amount)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  headerBar: {
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMist,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: colors.cream,
  },
  headerTitle: { ...typography.headlineLg, color: colors.forestInk },
  content: { padding: 16, gap: 10 },
  stateCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { ...typography.bodyMd, color: colors.mutedText },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 14,
    gap: 12,
    ...shadows.subtle,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.forestInk },
  rowMeta: { fontSize: 11, color: colors.mutedText, lineHeight: 15 },
  amount: { ...typography.amountSm, fontWeight: '700' },
  errorBox: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.card,
    padding: 18,
    gap: 8,
  },
  errorTitle: { fontSize: 14, fontWeight: '700', color: colors.warningText },
  errorSub: { fontSize: 12, color: colors.warningText, opacity: 0.85 },
  retryBtn: {
    backgroundColor: colors.forestInk,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.button,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  retryBtnText: { color: colors.cream, fontWeight: '700', fontSize: 13 },
});

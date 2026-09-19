import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
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
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {status === 'loading' && <ActivityIndicator size="large" color={theme.colors.forestInk} />}
        {status === 'error' && (
          <View style={styles.box}>
            <Text style={styles.title}>{t('transactions.couldNotLoad')}</Text>
            <Text style={styles.sub}>{error && error.message}</Text>
            <TouchableOpacity style={styles.btn} onPress={reload}><Text style={styles.btnText}>{t('common.tryAgain')}</Text></TouchableOpacity>
          </View>
        )}
        {status === 'live' && list.length === 0 && (
          <Text style={styles.sub}>{t('transactions.noTransactions')}</Text>
        )}
        {list.map((tx) => {
          const out = OUT.includes(tx.tx_type);
          return (
            <View key={tx.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{tx.raw_text || tx.category}</Text>
                <Text style={styles.sub}>{tx.tx_type} · {tx.category} · {tx.target_pot} pot · {relativeDate(tx.created_at)}</Text>
              </View>
              <Text style={[styles.amount, { color: out ? '#B00020' : theme.colors.forestInk }]}>{out ? '−' : '+'}{money(tx.amount)}</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.paperCream },
  headerBar: { minHeight: 56, borderBottomWidth: 1, borderBottomColor: theme.colors.panelKeylime, justifyContent: 'center', paddingHorizontal: 20 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.forestInk },
  content: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B1DBB8', borderRadius: 12, padding: 12, gap: 8 },
  box: { gap: 8, alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', color: theme.colors.forestInk },
  sub: { fontSize: 12, color: '#222222', opacity: 0.75 },
  amount: { fontSize: 16, fontWeight: '700' },
  btn: { backgroundColor: theme.colors.forestInk, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  btnText: { color: theme.colors.paperCream, fontWeight: '700' },
});

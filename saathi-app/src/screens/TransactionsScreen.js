import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { getTransactions } from '../services/personBClient.js';
import { relativeDate } from '../services/viewModels.js';
import { useLiveData } from '../hooks/useLiveData';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const OUT = ['expense', 'commitment'];

// Every income / expense / saving Person B has recorded (Chat, WhatsApp). Business Khata entries live in their own tab.
export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { status, data, error, reload } = useLiveData(getTransactions);
  const list = (data && data.transactions) || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Len-Den • Transactions</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {status === 'loading' && <ActivityIndicator size="large" color={theme.colors.forestInk} />}
        {status === 'error' && (
          <View style={styles.box}>
            <Text style={styles.title}>Couldn't load transactions</Text>
            <Text style={styles.sub}>{error && error.message}</Text>
            <TouchableOpacity style={styles.btn} onPress={reload}><Text style={styles.btnText}>Try again</Text></TouchableOpacity>
          </View>
        )}
        {status === 'live' && list.length === 0 && (
          <Text style={styles.sub}>Nothing recorded yet. Tell Saathi in Chat or WhatsApp, for example "spent 200 on groceries".</Text>
        )}
        {list.map((t) => {
          const out = OUT.includes(t.tx_type);
          return (
            <View key={t.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t.raw_text || t.category}</Text>
                <Text style={styles.sub}>{t.tx_type} · {t.category} · {t.target_pot} pot · {relativeDate(t.created_at)}</Text>
              </View>
              <Text style={[styles.amount, { color: out ? '#B00020' : theme.colors.forestInk }]}>{out ? '−' : '+'}{money(t.amount)}</Text>
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

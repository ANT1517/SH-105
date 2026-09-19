import React, { useState } from 'react';
import FormModal from '../components/FormModal';
import * as ImagePicker from 'expo-image-picker';
import { scanReceipt } from '../services/personCClient.js';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MEERA_FIXTURE } from '../api/fixture';
import { addLedgerEntry, getLedger } from '../services/personBClient.js';
import { buildLedgerViewModel, fixtureToLedger } from '../services/viewModels.js';
import { OFFLINE_BANNER } from '../services/liveData.js';
import { useLiveData } from '../hooks/useLiveData';

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  forestInk: '#0F3E17',
  cream:     '#FFFEFC',
  keylime:   '#E1F4DF',
  mint:      '#CFE7D3',
  sage:      '#B1DBB8',
  slate:     '#B6CED5',
  charcoal:  '#222222',
  white:     '#FFFFFF',
  border:    '#EFEEEB',
  hairline:  '#E5E3DC',
};

// Live data from Person B (GET /api/ledger). The bundled fixture is ONLY an explicit offline fallback (with a
// banner), used if the live call fails. It is never the default.
const offlineSample = () => fixtureToLedger(MEERA_FIXTURE);

export default function LedgerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [scanning, setScanning] = useState(false);

  // Photo of a bill -> Person C OCR -> the same entry form, pre-filled, so nothing is saved until you confirm.
  const scanBill = async (camera) => {
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
      if (!perm.granted) { Alert.alert('Camera permission is needed to scan a bill.'); return; }
      const pick = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const res = await pick({ mediaTypes: ['images'], quality: 0.8 });
      if (res.canceled) return;
      const asset = res.assets[0];
      setScanning(true);
      const out = await scanReceipt({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType || 'image/jpeg' });
      setPrefill({
        activity: 'Bill',
        cost: out.amount ? String(out.amount) : '',
        notes: `Scanned bill${out.date ? ` (${out.date})` : ''}${out.amount ? '' : ' - amount not found, please enter it'}`,
      });
      setFormOpen(true);
    } catch (e) {
      Alert.alert('Could not scan the bill', e && e.message ? e.message : 'Try again.');
    } finally {
      setScanning(false);
    }
  };
  const { status, data: ledger, error, reload } = useLiveData(getLedger, offlineSample);

  if (status === 'loading' || !ledger) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.forestInk} />
          <Text style={styles.loadingText}>Loading your ledger...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const vm = buildLedgerViewModel(ledger);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerEyebrow}>VYAPAR KHATA</Text>
          <Text style={styles.headerTitle}>Business Ledger</Text>
        </View>
      </View>

      {status === 'offline' && (
        <View style={styles.offlineBanner} accessibilityRole="alert">
          <Text style={styles.offlineBannerText}>{OFFLINE_BANNER}</Text>
          {error && error.message ? <Text style={styles.offlineBannerDetail}>{error.message}</Text> : null}
        </View>
      )}

      <View style={styles.mainWrapper}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── 1. SUMMARY CARD ──────────────────────────────────────────── */}
          <View style={styles.summaryCard}>
            {/* Activity Pill Badge */}
            <View style={styles.activityBadge}>
              <Text style={styles.activityBadgeText}>{vm.badgeLabel}</Text>
            </View>

            {/* Figures Row */}
            <View style={styles.figuresRow}>
              <View style={styles.figureItem}>
                <Text style={styles.figureLabel}>Kamai / Revenue</Text>
                <Text style={styles.figureValue}>{vm.revenue}</Text>
              </View>
              <View style={styles.figureItem}>
                <Text style={styles.figureLabel}>Kharcha / Cost</Text>
                <Text style={styles.figureValue}>{vm.cost}</Text>
              </View>
              <View style={[styles.figureItem, styles.profitHighlightItem]}>
                <Text style={styles.profitLabel}>Munafa / Profit</Text>
                <Text style={styles.profitValue}>{vm.profit}{vm.profitNum > 0 ? ' ↑' : ''}</Text>
              </View>
            </View>

            {/* Reassurance text */}
            {vm.profitNum > 0 && (
              <Text style={styles.reassuranceText}>
                Yeh kamai aapke Business pot mein gayi. — This income went into your Business pot.
              </Text>
            )}

            {/* Secondary CTA */}
            
          </View>

          {/* ── 3. RECENT ENTRIES ────────────────────────────────────────── */}
          <View style={styles.entriesSection}>
            <View style={styles.entriesSectionHeader}>
              <Text style={styles.sectionTitle}>Haal ki Entries — Recent Entries</Text>
            </View>

            {!vm.hasEntries && (
              <Text style={styles.entryDate}>No business entries yet. Tell Saathi about a sale in Chat to add one.</Text>
            )}

            <View style={styles.entriesList}>
              {vm.entries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryLeftInfo}>
                    <Text style={styles.entryName}>{entry.name}</Text>
                    <Text style={styles.entryHindi}>{entry.detail}</Text>
                    <Text style={styles.entryDate}>{entry.date}</Text>
                  </View>
                  <Text style={styles.entryAmount}>{entry.amount}</Text>
                </View>
              ))}
            </View>

            {/* View All button */}
            
          </View>

        </ScrollView>

        {/* ── FLOATING ADD ENTRY BUTTON ─────────────────────────────────── */}
        <View style={[styles.bottomActionContainer, { bottom: insets.bottom + 16 }]}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1, backgroundColor: C.cream }]} disabled={scanning} onPress={() => scanBill(true)}>
              <Text style={styles.secondaryButtonText}>{scanning ? 'Reading bill...' : '📷 Scan bill'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1, backgroundColor: C.cream }]} disabled={scanning} onPress={() => scanBill(false)}>
              <Text style={styles.secondaryButtonText}>🖼 From gallery</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.8} onPress={() => { setPrefill(null); setFormOpen(true); }}>
            <Text style={styles.primaryActionButtonText}>+ Nayi Entry — Add New Entry</Text>
          </TouchableOpacity>
        </View>
        <FormModal
          visible={formOpen}
          initialValues={prefill}
          title="Nayi Entry — New Entry"
          fields={[
            { key: 'activity', label: 'What was it? (e.g. tailoring, pickles)' },
            { key: 'revenue', label: 'Kamai / Revenue (₹)', keyboardType: 'numeric' },
            { key: 'cost', label: 'Kharcha / Cost (₹)', keyboardType: 'numeric' },
            { key: 'notes', label: 'Note (optional)' },
          ]}
          onClose={() => setFormOpen(false)}
          onSubmit={async (v) => {
            if (!(v.activity || '').trim()) throw new Error('Please say what the entry is for.');
            await addLedgerEntry({ activity: v.activity.trim(), revenue: v.revenue || '0', cost: v.cost || '0', notes: v.notes || '' });
            await reload();
          }}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: C.charcoal },
  offlineBanner: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 12, marginHorizontal: 16, marginTop: 8, gap: 4 },
  offlineBannerText: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  offlineBannerDetail: { fontSize: 11, color: '#92400E', opacity: 0.8 },
  safeArea:    { flex: 1, backgroundColor: C.cream },
  mainWrapper: { flex: 1, backgroundColor: C.cream },
  scrollView:  { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

  // Header
  headerBar:    { backgroundColor: C.cream, borderBottomWidth: 1, borderBottomColor: C.keylime, paddingHorizontal: 20, paddingVertical: 12 },
  headerEyebrow:{ fontSize: 10, fontWeight: '600', color: C.forestInk, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle:  { fontSize: 22, fontWeight: '700', color: C.forestInk, letterSpacing: 0.3 },

  // 1. Summary Card
  summaryCard:  { backgroundColor: C.sage, borderRadius: 14, padding: 24, gap: 14, alignItems: 'flex-start' },
  activityBadge:{ backgroundColor: C.keylime, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  activityBadgeText: { fontSize: 12, fontWeight: '600', color: C.forestInk },
  figuresRow:   { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 8 },
  figureItem:   { flex: 1, backgroundColor: C.cream, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', gap: 4 },
  profitHighlightItem: { backgroundColor: C.keylime, borderWidth: 1.5, borderColor: C.forestInk },
  figureLabel:  { fontSize: 11, fontWeight: '500', color: C.charcoal, textAlign: 'center', lineHeight: 15 },
  profitLabel:  { fontSize: 11, fontWeight: '600', color: C.forestInk, textAlign: 'center', lineHeight: 15 },
  figureValue:  { fontSize: 15, fontWeight: '700', color: C.forestInk },
  profitValue:  { fontSize: 18, fontWeight: '700', color: C.forestInk },
  reassuranceText: { fontSize: 13, fontWeight: '400', color: C.charcoal, lineHeight: 19 },
  secondaryButton: { borderWidth: 1.5, borderColor: C.forestInk, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'stretch', alignItems: 'center', backgroundColor: 'transparent' },
  secondaryButtonText: { fontSize: 14, fontWeight: '600', color: C.forestInk },

  // 2. Voice Memo Card
  voiceMemoCard:   { backgroundColor: C.keylime, borderRadius: 14, padding: 18, gap: 10 },
  voiceMemoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voiceMemoPill:   { backgroundColor: C.cream, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#C8EDCA' },
  voiceMemoPillText:{ fontSize: 12, fontWeight: '600', color: C.forestInk },
  voiceMemoDuration:{ fontSize: 12, fontWeight: '500', color: C.charcoal },
  voiceMemoHindi:   { fontSize: 14, fontWeight: '600', color: C.forestInk, lineHeight: 21, fontStyle: 'italic' },
  voiceMemoEnglish: { fontSize: 12, fontWeight: '400', color: C.charcoal, lineHeight: 18 },
  playBtn:     { borderWidth: 1, borderColor: C.forestInk, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'flex-start' },
  playBtnText: { fontSize: 13, fontWeight: '600', color: C.forestInk },

  // 3. Recent Entries
  entriesSection:      { gap: 12 },
  entriesSectionHeader:{ flexDirection: 'row', alignItems: 'baseline' },
  sectionTitle:        { fontSize: 16, fontWeight: '700', color: C.forestInk },
  entriesList:         { gap: 10 },
  entryCard:           { backgroundColor: C.cream, borderWidth: 1, borderColor: C.sage, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryLeftInfo:       { gap: 2 },
  entryName:           { fontSize: 15, fontWeight: '600', color: C.forestInk },
  entryHindi:          { fontSize: 12, fontWeight: '400', color: C.charcoal, opacity: 0.75 },
  entryDate:           { fontSize: 11, fontWeight: '400', color: C.charcoal, opacity: 0.6, marginTop: 1 },
  entryAmount:         { fontSize: 16, fontWeight: '700', color: C.forestInk },

  // View All
  viewAllBtn:    { borderWidth: 1.5, borderColor: C.forestInk, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: 'transparent' },
  viewAllBtnText:{ fontSize: 13, fontWeight: '600', color: C.forestInk },

  // Floating Add Button
  bottomActionContainer: { position: 'absolute', left: 16, right: 16 },
  primaryActionButton:   { backgroundColor: C.forestInk, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  primaryActionButtonText:{ fontSize: 15, fontWeight: '600', color: C.cream },
});

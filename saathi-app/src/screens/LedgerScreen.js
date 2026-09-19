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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { MEERA_FIXTURE } from '../api/fixture';
import { addLedgerEntry, getLedger } from '../services/personBClient.js';
import { buildLedgerViewModel, fixtureToLedger } from '../services/viewModels.js';
import { OFFLINE_BANNER } from '../services/liveData.js';
import { useLiveData } from '../hooks/useLiveData';
import { colors, radius, shadows, typography } from '../theme';

// Live data from Person B (GET /api/ledger). The bundled fixture is ONLY an explicit offline fallback (with a
// banner), used if the live call fails. It is never the default.
const offlineSample = () => fixtureToLedger(MEERA_FIXTURE);

export default function LedgerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [scanning, setScanning] = useState(false);

  // Photo of a bill -> Person C OCR -> the same entry form, pre-filled, so nothing is saved until you confirm.
  const scanBill = async (camera) => {
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
      if (!perm.granted) { Alert.alert(t('ledger.cameraPermNeeded')); return; }
      const pick = camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const res = await pick({ mediaTypes: ['images'], quality: 0.8 });
      if (res.canceled) return;
      const asset = res.assets[0];
      setScanning(true);
      const out = await scanReceipt({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType || 'image/jpeg' });
      setPrefill({
        activity: t('ledger.billActivity', { defaultValue: 'Bill' }),
        cost: out.amount ? String(out.amount) : '',
        notes: t('ledger.billNotes', {
          datePart: out.date ? t('ledger.billNotesDate', { date: out.date, defaultValue: ` (${out.date})` }) : '',
          amountNote: out.amount ? '' : t('ledger.billNotesNoAmount', { defaultValue: ' - amount not found, please enter it' }),
          defaultValue: `Scanned bill${out.date ? ` (${out.date})` : ''}${out.amount ? '' : ' - amount not found, please enter it'}`,
        }),
      });
      setFormOpen(true);
    } catch (e) {
      Alert.alert(t('ledger.scanBillFailed'), e && e.message ? e.message : t('common.tryAgain'));
    } finally {
      setScanning(false);
    }
  };
  const { status, data: ledger, error, reload } = useLiveData(getLedger, offlineSample);

  if (status === 'loading' || !ledger) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.forestInk} />
          <Text style={styles.loadingText}>{t('ledger.loadingLedger')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const vm = buildLedgerViewModel(ledger, new Date(), t);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerEyebrow}>{t('ledger.headerEyebrow')}</Text>
          <Text style={styles.headerTitle}>{t('ledger.headerTitle')}</Text>
        </View>
      </View>

      {status === 'offline' && (
        <View style={styles.offlineBanner} accessibilityRole="alert">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warningText} />
            <Text style={styles.offlineBannerText}>{OFFLINE_BANNER}</Text>
          </View>
          {error && error.message ? <Text style={styles.offlineBannerDetail}>{error.message}</Text> : null}
        </View>
      )}

      <View style={styles.mainWrapper}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── 1. SUMMARY CARD ──────────────────────────────────────────── */}
          <View style={styles.summaryCard}>
            {/* Activity Pill Badge */}
            <View style={styles.activityBadge}>
              <Ionicons name="briefcase-outline" size={12} color={colors.forestInk} style={{ marginRight: 4 }} />
              <Text style={styles.activityBadgeText}>{vm.badgeLabel}</Text>
            </View>

            {/* Figures Row */}
            <View style={styles.figuresRow}>
              <View style={styles.figureItem}>
                <Text style={styles.figureLabel}>{t('ledger.revenue')}</Text>
                <Text style={styles.figureValue}>{vm.revenue}</Text>
              </View>
              <View style={styles.figureItem}>
                <Text style={styles.figureLabel}>{t('ledger.cost')}</Text>
                <Text style={styles.figureValue}>{vm.cost}</Text>
              </View>
              <View style={[styles.figureItem, styles.profitHighlightItem]}>
                <Text style={styles.profitLabel}>{t('ledger.profit')}</Text>
                <Text style={styles.profitValue}>{vm.profit}{vm.profitNum > 0 ? ' ↑' : ''}</Text>
              </View>
            </View>

            {/* Reassurance text */}
            {vm.profitNum > 0 && (
              <Text style={styles.reassuranceText}>
                {t('ledger.reassurance')}
              </Text>
            )}
          </View>

          {/* ── 2. RECENT ENTRIES ────────────────────────────────────────── */}
          <View style={styles.entriesSection}>
            <View style={styles.entriesSectionHeader}>
              <Text style={styles.sectionTitle}>{t('ledger.recentEntries')}</Text>
            </View>

            {!vm.hasEntries && (
              <Text style={styles.noEntriesText}>{t('ledger.noEntries')}</Text>
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
          </View>

        </ScrollView>

        {/* ── FLOATING ADD ENTRY BUTTON ─────────────────────────────────── */}
        <View style={[styles.bottomActionContainer, { bottom: insets.bottom + 12 }]}>
          <View style={styles.scanRow}>
            <TouchableOpacity
              style={styles.scanButton}
              disabled={scanning}
              onPress={() => scanBill(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-outline" size={15} color={colors.forestInk} style={{ marginRight: 6 }} />
              <Text style={styles.scanButtonText}>{scanning ? t('ledger.readingBill') : t('ledger.scanBill')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.scanButton}
              disabled={scanning}
              onPress={() => scanBill(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="image-outline" size={15} color={colors.forestInk} style={{ marginRight: 6 }} />
              <Text style={styles.scanButtonText}>{t('ledger.fromGallery')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.primaryActionButton}
            activeOpacity={0.8}
            onPress={() => { setPrefill(null); setFormOpen(true); }}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.cream} style={{ marginRight: 6 }} />
            <Text style={styles.primaryActionButtonText}>{t('ledger.addNewEntry')}</Text>
          </TouchableOpacity>
        </View>

        <FormModal
          visible={formOpen}
          initialValues={prefill}
          title={t('ledger.modalTitle')}
          fields={[
            { key: 'activity', label: t('ledger.fieldActivity') },
            { key: 'revenue', label: t('ledger.fieldRevenue'), keyboardType: 'numeric' },
            { key: 'cost', label: t('ledger.fieldCost'), keyboardType: 'numeric' },
            { key: 'notes', label: t('ledger.fieldNotes') },
          ]}
          onClose={() => setFormOpen(false)}
          onSubmit={async (v) => {
            if (!(v.activity || '').trim()) throw new Error(t('ledger.errorActivity'));
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
  loadingText: { ...typography.bodyMd, color: colors.charcoal },
  offlineBanner: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.card,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 4,
  },
  offlineBannerText: { fontSize: 13, fontWeight: '700', color: colors.warningText },
  offlineBannerDetail: { fontSize: 11, color: colors.warningText, opacity: 0.85, paddingLeft: 22 },
  safeArea:    { flex: 1, backgroundColor: colors.cream },
  mainWrapper: { flex: 1, backgroundColor: colors.cream },
  scrollView:  { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 14, gap: 16 },

  // Header
  headerBar:    { backgroundColor: colors.cream, borderBottomWidth: 1, borderBottomColor: colors.borderMist, paddingHorizontal: 20, paddingVertical: 12 },
  headerEyebrow:{ ...typography.labelSm, color: colors.forestSubtle, marginBottom: 2 },
  headerTitle:  { ...typography.headlineLg, color: colors.forestInk },

  // 1. Summary Card
  summaryCard:  {
    backgroundColor: colors.panelSage,
    borderRadius: radius.card,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#A4D1AC',
    ...shadows.card,
  },
  activityBadge:{
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelKeylime,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.badge,
    alignSelf: 'flex-start',
  },
  activityBadgeText: { fontSize: 12, fontWeight: '600', color: colors.forestInk },
  figuresRow:   { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 8 },
  figureItem:   {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profitHighlightItem: { backgroundColor: colors.panelKeylime, borderWidth: 1.5, borderColor: colors.forestInk },
  figureLabel:  { fontSize: 11, fontWeight: '500', color: colors.mutedText, textAlign: 'center', lineHeight: 14 },
  profitLabel:  { fontSize: 11, fontWeight: '600', color: colors.forestInk, textAlign: 'center', lineHeight: 14 },
  figureValue:  { fontSize: 15, fontWeight: '700', color: colors.forestInk },
  profitValue:  { fontSize: 17, fontWeight: '700', color: colors.forestInk },
  reassuranceText: { ...typography.bodySm, color: colors.forestInkSub, lineHeight: 18 },

  // 2. Recent Entries
  entriesSection:      { gap: 10 },
  entriesSectionHeader:{ flexDirection: 'row', alignItems: 'baseline' },
  sectionTitle:        { ...typography.headlineSm, color: colors.forestInk },
  noEntriesText:       { ...typography.bodySm, color: colors.mutedText, fontStyle: 'italic', paddingVertical: 12 },
  entriesList:         { gap: 8 },
  entryCard:           {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.subtle,
  },
  entryLeftInfo:       { gap: 2, flex: 1 },
  entryName:           { fontSize: 14, fontWeight: '600', color: colors.forestInk },
  entryHindi:          { fontSize: 12, fontWeight: '400', color: colors.mutedText },
  entryDate:           { fontSize: 11, fontWeight: '400', color: colors.textTertiary, marginTop: 1 },
  entryAmount:         { ...typography.amountSm, color: colors.forestInk },

  // Floating Add Button
  bottomActionContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255, 254, 252, 0.95)',
    paddingTop: 8,
    paddingBottom: 4,
    borderRadius: radius.card,
  },
  scanRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  scanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
    borderRadius: radius.button,
    paddingVertical: 10,
    ...shadows.subtle,
  },
  scanButtonText: { fontSize: 13, fontWeight: '600', color: colors.forestInk },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forestInk,
    borderRadius: radius.button,
    paddingVertical: 13,
    ...shadows.card,
  },
  primaryActionButtonText:{ fontSize: 14, fontWeight: '700', color: colors.cream },
});

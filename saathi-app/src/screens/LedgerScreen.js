import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MEERA_FIXTURE } from '../api/fixture';

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

const { ledger } = MEERA_FIXTURE;
const { summary, voiceMemo, recentEntries } = ledger;

export default function LedgerScreen() {
  const insets = useSafeAreaInsets();

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
              <Text style={styles.activityBadgeText}>{summary.badgeLabel}</Text>
            </View>

            {/* Figures Row */}
            <View style={styles.figuresRow}>
              <View style={styles.figureItem}>
                <Text style={styles.figureLabel}>Kamai / Revenue</Text>
                <Text style={styles.figureValue}>{summary.revenue}</Text>
              </View>
              <View style={styles.figureItem}>
                <Text style={styles.figureLabel}>Kharcha / Cost</Text>
                <Text style={styles.figureValue}>{summary.cost}</Text>
              </View>
              <View style={[styles.figureItem, styles.profitHighlightItem]}>
                <Text style={styles.profitLabel}>Munafa / Profit</Text>
                <Text style={styles.profitValue}>{summary.profit} ↑</Text>
              </View>
            </View>

            {/* Reassurance text */}
            <Text style={styles.reassuranceText}>{summary.reassuranceText}</Text>

            {/* Secondary CTA */}
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.7}>
              <Text style={styles.secondaryButtonText}>{summary.ctaText}</Text>
            </TouchableOpacity>
          </View>

          {/* ── 2. ORIGINAL VOICE MEMO CARD ─────────────────────────────── */}
          <View style={styles.voiceMemoCard}>
            <View style={styles.voiceMemoHeader}>
              <View style={styles.voiceMemoPill}>
                <Text style={styles.voiceMemoPillText}>🎙️ Awaaz se — Voice Memo</Text>
              </View>
              <Text style={styles.voiceMemoDuration}>{voiceMemo.duration}</Text>
            </View>
            <Text style={styles.voiceMemoHindi}>&ldquo;{voiceMemo.hindiText}&rdquo;</Text>
            <Text style={styles.voiceMemoEnglish}>{voiceMemo.englishText}</Text>
            <TouchableOpacity style={styles.playBtn} activeOpacity={0.7}>
              <Text style={styles.playBtnText}>▶ Play memo</Text>
            </TouchableOpacity>
          </View>

          {/* ── 3. RECENT ENTRIES ────────────────────────────────────────── */}
          <View style={styles.entriesSection}>
            <View style={styles.entriesSectionHeader}>
              <Text style={styles.sectionTitle}>Haal ki Entries — Recent Entries</Text>
            </View>

            <View style={styles.entriesList}>
              {recentEntries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryLeftInfo}>
                    <Text style={styles.entryName}>{entry.name}</Text>
                    <Text style={styles.entryHindi}>{entry.hindiName}</Text>
                    <Text style={styles.entryDate}>{entry.date}</Text>
                  </View>
                  <Text style={styles.entryAmount}>{entry.amount}</Text>
                </View>
              ))}
            </View>

            {/* View All button */}
            <TouchableOpacity style={styles.viewAllBtn} activeOpacity={0.7}>
              <Text style={styles.viewAllBtnText}>Saari entries dekhein — View All Business Entries →</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>

        {/* ── FLOATING ADD ENTRY BUTTON ─────────────────────────────────── */}
        <View style={[styles.bottomActionContainer, { bottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.8}>
            <Text style={styles.primaryActionButtonText}>+ Nayi Entry — Add New Entry</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
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

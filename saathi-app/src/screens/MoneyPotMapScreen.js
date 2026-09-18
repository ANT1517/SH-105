import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MEERA_FIXTURE, getFormattedTotal } from '../api/fixture';

// ─── Design tokens (Botanical Greenhouse) ───────────────────────────────────
const C = {
  forestInk:   '#0F3E17',
  cream:       '#FFFEFC',
  keylime:     '#E1F4DF',
  mint:        '#CFE7D3',
  sage:        '#B1DBB8',
  slate:       '#B6CED5',
  charcoal:    '#222222',
  white:       '#FFFFFF',
  border:      '#EFEEEB',
  hairline:    '#E5E3DC',
};

const { potsList, chit, educationGoal, recentEarnings } = MEERA_FIXTURE;

export default function MoneyPotMapScreen() {
  const insets = useSafeAreaInsets();
  const goalPct = Math.min(
    (educationGoal.savedAmount / educationGoal.targetAmount) * 100,
    100,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 1. HEADER ROW ──────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingLabel}>Namaste 🙏</Text>
            <Text style={styles.greetingName}>
              {MEERA_FIXTURE.user.name} — आपका स्वागत है
            </Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
            <Text style={styles.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* ── 2. HERO BALANCE CARD ────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>AAPKE PAAS KULL</Text>
          <Text style={styles.heroLabel}>Total Money in Your Hands</Text>
          <Text style={styles.heroAmount}>{getFormattedTotal()}</Text>
          <Text style={styles.heroSubtext}>
            Saare pots milakar — Counted together, all your savings pots are safe
          </Text>
        </View>

        {/* ── 3. SAFE & TRUSTED PILL ──────────────────────────────────── */}
        <View style={styles.safePillRow}>
          <View style={styles.safePill}>
            <Text style={styles.safePillText}>🔒 Aapka paisa surakshit hai — Safe &amp; Trusted</Text>
          </View>
        </View>

        {/* ── 4. YOUR 5 POTS ─────────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Aapke 5 Pots — Your 5 Pots</Text>
          <Text style={styles.sectionSubtitle}>Tap to open</Text>
        </View>

        <View style={styles.potsGrid}>
          {potsList.map((pot) => (
            <TouchableOpacity key={pot.id} style={styles.potCard} activeOpacity={0.8}>
              <View style={styles.potCardTop}>
                <Text style={styles.potName}>{pot.name}</Text>
                {/* Speaker icon — tap for audio explanation */}
                <TouchableOpacity activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.speakerIcon}>🔊</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.potSubLabel}>{pot.subLabel}</Text>
              <Text style={styles.potAmount}>{pot.amount}</Text>
              <View style={styles.potStatusPill}>
                <Text style={styles.potStatusText}>{pot.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 5. CHIT (LOCKED) CARD ───────────────────────────────────── */}
        <View style={styles.chitCard}>
          <View style={styles.chitHeaderRow}>
            <Text style={styles.chitName}>{chit.name}</Text>
            <View style={styles.chitLockBadge}>
              <Text style={styles.chitLockText}>🔒 Band hai</Text>
            </View>
          </View>
          <Text style={styles.chitAmount}>{chit.amount}</Text>
          <Text style={styles.chitStatus}>{chit.status}</Text>
        </View>

        {/* ── 6. SAATHI'S GENTLE NOTE ─────────────────────────────────── */}
        <View style={styles.gentleNoteCard}>
          <View style={styles.gentleNoteHeader}>
            <Text style={styles.gentleNoteIcon}>💬</Text>
            <Text style={styles.gentleNoteHeading}>Saathi ki Baat — Saathi's Gentle Note</Text>
          </View>
          <Text style={styles.gentleNoteBody}>
            Aapka Chit commitment har mahine ₹4,000 hai. Yeh paisa abhi kharcha nahi kar sakte —
            isliye hum ise "kharch hone wala" paisa nahi maante.{'\n\n'}
            Your Chit commitment is ₹4,000 every month. Because that money is locked, we leave it
            out of cash you can spend right now.
          </Text>
          <TouchableOpacity style={styles.audioBtn} activeOpacity={0.7}>
            <Text style={styles.audioBtnText}>🔊 Awaaz mein suniye — Hear audio explanation (30 sec)</Text>
          </TouchableOpacity>
        </View>

        {/* ── 7. EDUCATION GOAL CARD ──────────────────────────────────── */}
        <View style={styles.goalCard}>
          <View style={styles.goalCardTop}>
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>{educationGoal.hindiTitle}</Text>
            </View>
            <Text style={styles.goalPct}>{Math.round(goalPct)}% done</Text>
          </View>
          <Text style={styles.goalTitle}>{educationGoal.title}</Text>
          <Text style={styles.goalSubtext}>{educationGoal.subtext}</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${goalPct}%` }]} />
          </View>

          <View style={styles.goalMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Bachaya / Saved</Text>
              <Text style={styles.metricValue}>{educationGoal.savedText}</Text>
            </View>
            <View style={[styles.metricItem, styles.metricDivider]}>
              <Text style={styles.metricLabel}>Lakshya / Target</Text>
              <Text style={styles.metricValue}>{educationGoal.targetText}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Mahiney / Monthly</Text>
              <Text style={styles.metricValue}>{educationGoal.monthlyAmount}/mo</Text>
            </View>
          </View>

          <Text style={styles.goalReassurance}>
            Har mahine {educationGoal.monthlyAmount} bachane se 6 mahine mein lakshya poora hoga. —
            Saving {educationGoal.monthlyAmount} every month will reach your target in 6 months.
          </Text>
        </View>

        {/* ── 8. RECENT EARNINGS CARD ─────────────────────────────────── */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsHeading}>{recentEarnings.heading}</Text>

          <View style={styles.earningsRow}>
            {recentEarnings.items.map((item, i) => (
              <View
                key={i}
                style={[styles.earningsItem, item.isHighlight && styles.earningsItemHL]}
              >
                <Text style={[styles.earningsLabel, item.isHighlight && styles.earningsLabelHL]}>
                  {item.label}
                </Text>
                <Text style={styles.earningsHindi}>{item.hindiLabel}</Text>
                <Text style={[styles.earningsAmt, item.isHighlight && styles.earningsAmtHL]}>
                  {item.amount}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.earningsSubtext}>{recentEarnings.subtext}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: C.cream },
  scroll:    { flex: 1, backgroundColor: C.cream },
  content:   { paddingHorizontal: 16, paddingTop: 12, gap: 16 },

  // 1. Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8 },
  greetingLabel: { fontSize: 11, fontWeight: '600', color: C.forestInk, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  greetingName:  { fontSize: 18, fontWeight: '700', color: C.forestInk },
  bellBtn:  { padding: 8, backgroundColor: C.keylime, borderRadius: 999 },
  bellIcon: { fontSize: 16 },

  // 2. Hero
  heroCard: { backgroundColor: C.sage, borderRadius: 14, padding: 24, gap: 6 },
  heroEyebrow: { fontSize: 10, fontWeight: '600', color: C.forestInk, letterSpacing: 1.2, textTransform: 'uppercase' },
  heroLabel:   { fontSize: 13, fontWeight: '500', color: C.charcoal },
  heroAmount:  { fontSize: 36, fontWeight: '700', color: C.forestInk, marginVertical: 4 },
  heroSubtext: { fontSize: 13, fontWeight: '400', color: C.charcoal, lineHeight: 18 },

  // 3. Safe pill
  safePillRow: { alignItems: 'flex-start' },
  safePill:    { backgroundColor: C.keylime, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#C8EDCA' },
  safePillText:{ fontSize: 13, fontWeight: '600', color: C.forestInk },

  // 4. Pots
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 },
  sectionTitle:    { fontSize: 16, fontWeight: '700', color: C.forestInk },
  sectionSubtitle: { fontSize: 12, fontWeight: '500', color: C.charcoal, opacity: 0.6 },
  potsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  potCard: { width: '48%', backgroundColor: C.white, borderWidth: 1, borderColor: C.sage, borderRadius: 14, padding: 16, gap: 4 },
  potCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  potName:   { fontSize: 14, fontWeight: '700', color: C.forestInk, flex: 1 },
  speakerIcon: { fontSize: 14 },
  potSubLabel: { fontSize: 11, fontWeight: '400', color: C.charcoal, opacity: 0.75 },
  potAmount:  { fontSize: 20, fontWeight: '700', color: C.forestInk, marginTop: 6, marginBottom: 6 },
  potStatusPill: { backgroundColor: C.keylime, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, alignSelf: 'flex-start' },
  potStatusText: { fontSize: 11, fontWeight: '600', color: C.forestInk },

  // 5. Chit
  chitCard:      { backgroundColor: C.slate, borderRadius: 14, padding: 20, gap: 6 },
  chitHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chitName:      { fontSize: 16, fontWeight: '700', color: C.forestInk },
  chitLockBadge: { backgroundColor: 'rgba(255,255,255,0.45)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  chitLockText:  { fontSize: 12, fontWeight: '600', color: C.forestInk },
  chitAmount:    { fontSize: 26, fontWeight: '700', color: C.forestInk, marginVertical: 2 },
  chitStatus:    { fontSize: 13, fontWeight: '400', color: C.charcoal },

  // 6. Gentle Note
  gentleNoteCard:    { backgroundColor: C.keylime, borderRadius: 14, padding: 20, gap: 12 },
  gentleNoteHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gentleNoteIcon:    { fontSize: 16 },
  gentleNoteHeading: { fontSize: 15, fontWeight: '700', color: C.forestInk, flex: 1 },
  gentleNoteBody:    { fontSize: 13, fontWeight: '400', color: C.charcoal, lineHeight: 20 },
  audioBtn:     { borderWidth: 1.5, borderColor: C.forestInk, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start' },
  audioBtnText: { fontSize: 13, fontWeight: '600', color: C.forestInk },

  // 7. Education Goal
  goalCard:    { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.sage, borderRadius: 14, padding: 20, gap: 12 },
  goalCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalBadge:   { backgroundColor: C.keylime, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
  goalBadgeText: { fontSize: 12, fontWeight: '600', color: C.forestInk },
  goalPct:     { fontSize: 13, fontWeight: '700', color: C.forestInk },
  goalTitle:   { fontSize: 17, fontWeight: '700', color: C.forestInk },
  goalSubtext: { fontSize: 12, fontWeight: '400', color: C.charcoal, lineHeight: 17 },
  progressTrack: { height: 10, backgroundColor: C.keylime, borderRadius: 999, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: C.forestInk, borderRadius: 999 },
  goalMetrics:   { flexDirection: 'row', backgroundColor: C.keylime, borderRadius: 10, padding: 12 },
  metricItem:    { flex: 1, alignItems: 'center', gap: 2 },
  metricDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.border },
  metricLabel:   { fontSize: 10, fontWeight: '600', color: C.charcoal, textAlign: 'center', lineHeight: 14 },
  metricValue:   { fontSize: 14, fontWeight: '700', color: C.forestInk },
  goalReassurance: { fontSize: 12, fontWeight: '400', color: C.charcoal, lineHeight: 18 },

  // 8. Recent Earnings
  earningsCard:    { backgroundColor: C.sage, borderRadius: 14, padding: 20, gap: 14 },
  earningsHeading: { fontSize: 15, fontWeight: '700', color: C.forestInk },
  earningsRow:     { flexDirection: 'row', gap: 8 },
  earningsItem:    { flex: 1, backgroundColor: C.cream, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 3 },
  earningsItemHL:  { backgroundColor: C.keylime, borderWidth: 1.5, borderColor: C.forestInk },
  earningsLabel:   { fontSize: 12, fontWeight: '600', color: C.charcoal },
  earningsLabelHL: { color: C.forestInk },
  earningsHindi:   { fontSize: 10, fontWeight: '400', color: C.charcoal, opacity: 0.7 },
  earningsAmt:     { fontSize: 14, fontWeight: '700', color: C.forestInk },
  earningsAmtHL:   { fontSize: 16 },
  earningsSubtext: { fontSize: 11, fontWeight: '400', color: C.charcoal, opacity: 0.8, lineHeight: 16 },
});

import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { MEERA_FIXTURE } from '../api/fixture';
import { getFinancialState } from '../services/personBClient.js';
import { buildPotsViewModel, fixtureToFinancialState } from '../services/viewModels.js';
import { OFFLINE_BANNER } from '../services/liveData.js';
import { useLiveData } from '../hooks/useLiveData';
import LanguageSelectorModal from '../components/LanguageSelectorModal';
import { useLanguage } from '../context/LanguageContext';
import { colors, radius, shadows, typography } from '../theme';

// Live data from Person B (GET /api/financial-state). The bundled fixture is ONLY an explicit offline fallback,
// used if the live call fails, and the screen says so with a banner. It is never the default.
const offlineSample = () => fixtureToFinancialState(MEERA_FIXTURE);

export default function MoneyPotMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { language, languageLabel } = useLanguage();
  const [langModalVisible, setLangModalVisible] = useState(false);
  const { status, data: state, error } = useLiveData(getFinancialState, offlineSample);

  if (status === 'loading' || !state) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.forestInk} />
          <Text style={styles.loadingText}>{t('moneyPotMap.loadingPots')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const vm = buildPotsViewModel(state, t);
  const { chit, goal, business } = vm;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {status === 'offline' && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <View style={styles.offlineHeader}>
              <Ionicons name="cloud-offline-outline" size={16} color={colors.warningText} />
              <Text style={styles.offlineBannerText}>{OFFLINE_BANNER}</Text>
            </View>
            {error && error.message ? <Text style={styles.offlineBannerDetail}>{error.message}</Text> : null}
          </View>
        )}

        {/* ── 1. HEADER ROW ──────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.greetingLabel}>{t('moneyPotMap.greetingEyebrow')}</Text>
            <Text style={styles.greetingName}>{t('moneyPotMap.greetingTitle')}</Text>
          </View>
          <View style={styles.headerActions}>
            {/* Language selector button */}
            <TouchableOpacity
              style={styles.langBtn}
              activeOpacity={0.7}
              onPress={() => setLangModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`${t('common.language')}, ${languageLabel}`}
            >
              <Text style={styles.langBtnLabel}>{t('common.language')}</Text>
              <View style={styles.langCurrentRow}>
                <Text style={styles.langBtnCurrent}>{languageLabel}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.forestInk} style={{ marginLeft: 3 }} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bellBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/safetyshield')}
              accessibilityRole="button"
              accessibilityLabel={t('safetyShield.headerTitle')}
            >
              <Ionicons name="shield-checkmark-outline" size={19} color={colors.forestInk} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. HERO BALANCE CARD ────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{t('moneyPotMap.heroEyebrow')}</Text>
          <Text style={styles.heroLabel}>{t('moneyPotMap.heroTitle')}</Text>
          <Text style={styles.heroAmount}>{vm.totalText}</Text>
          <Text style={styles.heroSubtext}>{t('moneyPotMap.heroSubtext')}</Text>
        </View>

        {/* ── 3. SAFE & TRUSTED PILL ──────────────────────────────────── */}
        <View style={styles.safePillRow}>
          <View style={styles.safePill}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.forestInk} style={{ marginRight: 6 }} />
            <Text style={styles.safePillText}>{t('moneyPotMap.safePill')}</Text>
          </View>
        </View>

        {/* ── 4. YOUR 5 POTS ─────────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('moneyPotMap.sectionTitle')}</Text>
          <Text style={styles.sectionSubtitle}>{t('moneyPotMap.sectionSubtitle')}</Text>
        </View>

        <View style={styles.potsGrid}>
          {vm.pots.map((pot) => (
            <TouchableOpacity
              key={pot.id}
              style={styles.potCard}
              activeOpacity={0.75}
              onPress={() => Alert.alert(pot.name, `${pot.subLabel}\n${pot.amount}\n${pot.status}`)}
            >
              <View style={styles.potCardTop}>
                <Text style={styles.potName} numberOfLines={1}>{pot.name}</Text>
              </View>
              <Text style={styles.potSubLabel} numberOfLines={1}>{pot.subLabel}</Text>
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
              <Ionicons name="lock-closed" size={11} color={colors.forestInk} style={{ marginRight: 4 }} />
              <Text style={styles.chitLockText}>{t('moneyPotMap.chitLocked')}</Text>
            </View>
          </View>
          <Text style={styles.chitAmount}>{chit.amount}</Text>
          <Text style={styles.chitStatus}>{chit.status}</Text>
        </View>

        {/* ── 6. SAATHI'S GENTLE NOTE ─────────────────────────────────── */}
        <View style={styles.gentleNoteCard}>
          <View style={styles.gentleNoteHeader}>
            <Ionicons name="sparkles" size={15} color={colors.forestInk} />
            <Text style={styles.gentleNoteHeading}>{t('moneyPotMap.gentleNoteHeading')}</Text>
          </View>
          <Text style={styles.gentleNoteBody}>
            {t('moneyPotMap.gentleNoteBody', { amount: chit.amount })}
          </Text>
        </View>

        {/* ── 7. GOAL CARD (live: Person B goal) ──────────────────────── */}
        {goal && (
          <View style={styles.goalCard}>
            <View style={styles.goalCardTop}>
              <View style={styles.goalBadge}>
                <Ionicons name="flag-outline" size={12} color={colors.forestInk} style={{ marginRight: 4 }} />
                <Text style={styles.goalBadgeText}>{t('moneyPotMap.goalBadge')}</Text>
              </View>
              <Text style={styles.goalPct}>{t('moneyPotMap.goalDone', { pct: goal.pct })}</Text>
            </View>
            <Text style={styles.goalTitle}>{goal.title}</Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(goal.pct, 100)}%` }]} />
            </View>

            <View style={styles.goalMetrics}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t('moneyPotMap.goalSaved')}</Text>
                <Text style={styles.metricValue}>{goal.savedText}</Text>
              </View>
              <View style={[styles.metricItem, styles.metricDivider]}>
                <Text style={styles.metricLabel}>{t('moneyPotMap.goalTarget')}</Text>
                <Text style={styles.metricValue}>{goal.targetText}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t('moneyPotMap.goalToGo')}</Text>
                <Text style={styles.metricValue}>{goal.remainingText}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── 8. BUSINESS CARD (live: Person B ledger summary) ────────── */}
        {business && (
          <View style={styles.earningsCard}>
            <Text style={styles.earningsHeading}>{t('moneyPotMap.businessHeading', { activity: business.activity })}</Text>

            <View style={styles.earningsRow}>
              <View style={styles.earningsItem}>
                <Text style={styles.earningsLabel}>{t('moneyPotMap.revenue')}</Text>
                <Text style={styles.earningsAmt}>{business.revenue}</Text>
              </View>
              <View style={styles.earningsItem}>
                <Text style={styles.earningsLabel}>{t('moneyPotMap.cost')}</Text>
                <Text style={styles.earningsAmt}>{business.cost}</Text>
              </View>
              <View style={[styles.earningsItem, styles.earningsItemHL]}>
                <Text style={[styles.earningsLabel, styles.earningsLabelHL]}>{t('moneyPotMap.profit')}</Text>
                <Text style={[styles.earningsAmt, styles.earningsAmtHL]}>{business.profit}</Text>
              </View>
            </View>

            <Text style={styles.earningsSubtext}>{t('moneyPotMap.latestLedger')}</Text>
          </View>
        )}

      </ScrollView>

      <LanguageSelectorModal
        visible={langModalVisible}
        onClose={() => setLangModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { ...typography.bodyMd, color: colors.charcoal },
  offlineBanner: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.card,
    padding: 12,
    gap: 4,
  },
  offlineHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offlineBannerText: { fontSize: 13, fontWeight: '700', color: colors.warningText },
  offlineBannerDetail: { fontSize: 11, color: colors.warningText, opacity: 0.85, paddingLeft: 22 },
  safeArea:  { flex: 1, backgroundColor: colors.cream },
  scroll:    { flex: 1, backgroundColor: colors.cream },
  content:   { paddingHorizontal: 16, paddingTop: 10, gap: 14 },

  // 1. Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  headerTitleWrap: { flex: 1, justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greetingLabel: { ...typography.labelSm, color: colors.forestSubtle, marginBottom: 2 },
  greetingName:  { ...typography.headlineMd, color: colors.forestInk },
  langBtn:  {
    minHeight: 40,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: colors.panelKeylime,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
    justifyContent: 'center',
  },
  langBtnLabel: { fontSize: 10, fontWeight: '600', color: colors.forestInk, opacity: 0.75, letterSpacing: 0.2 },
  langCurrentRow: { flexDirection: 'row', alignItems: 'center' },
  langBtnCurrent: { fontSize: 13, fontWeight: '700', color: colors.forestInk },
  bellBtn:  {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.panelKeylime,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
  },

  // 2. Hero
  heroCard: {
    backgroundColor: colors.panelSage,
    borderRadius: radius.card,
    padding: 22,
    gap: 4,
    borderWidth: 1,
    borderColor: '#A4D1AC',
    ...shadows.card,
  },
  heroEyebrow: { ...typography.labelSm, color: colors.forestInk, letterSpacing: 1.1 },
  heroLabel:   { ...typography.bodySm, fontWeight: '500', color: colors.charcoal },
  heroAmount:  { ...typography.heroAmount, color: colors.forestInk, marginVertical: 4 },
  heroSubtext: { ...typography.bodySm, color: colors.forestInk, opacity: 0.9, lineHeight: 18 },

  // 3. Safe pill
  safePillRow: { alignItems: 'flex-start' },
  safePill:    {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelKeylime,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
  },
  safePillText:{ fontSize: 12, fontWeight: '600', color: colors.forestInk },

  // 4. Pots
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 },
  sectionTitle:    { ...typography.headlineSm, color: colors.forestInk },
  sectionSubtitle: { ...typography.bodySm, color: colors.mutedText },
  potsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  potCard: {
    width: '48.5%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 14,
    gap: 4,
    ...shadows.subtle,
  },
  potCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  potName:   { fontSize: 14, fontWeight: '700', color: colors.forestInk, flex: 1 },
  potSubLabel: { fontSize: 11, fontWeight: '400', color: colors.mutedText, marginTop: 1 },
  potAmount:  { ...typography.cardAmount, fontSize: 19, marginTop: 4, marginBottom: 6 },
  potStatusPill: {
    backgroundColor: colors.panelKeylime,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.badge,
    alignSelf: 'flex-start',
  },
  potStatusText: { fontSize: 11, fontWeight: '600', color: colors.forestInk },

  // 5. Chit
  chitCard: {
    backgroundColor: colors.slateHush,
    borderRadius: radius.card,
    padding: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: '#B4CAD1',
    ...shadows.subtle,
  },
  chitHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chitName:      { fontSize: 15, fontWeight: '700', color: colors.forestInk },
  chitLockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.badge,
  },
  chitLockText:  { fontSize: 11, fontWeight: '600', color: colors.forestInk },
  chitAmount:    { ...typography.cardAmount, fontSize: 24, marginVertical: 2 },
  chitStatus:    { fontSize: 12, fontWeight: '500', color: colors.slateText },

  // 6. Gentle Note
  gentleNoteCard: {
    backgroundColor: colors.panelKeylime,
    borderRadius: radius.card,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
    ...shadows.subtle,
  },
  gentleNoteHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gentleNoteHeading: { fontSize: 14, fontWeight: '700', color: colors.forestInk, flex: 1 },
  gentleNoteBody:    { ...typography.bodyMd, color: colors.charcoal, lineHeight: 20 },

  // 7. Education Goal
  goalCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 18,
    gap: 10,
    ...shadows.subtle,
  },
  goalCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalBadge:   {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelKeylime,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.badge,
  },
  goalBadgeText: { fontSize: 11, fontWeight: '600', color: colors.forestInk },
  goalPct:     { fontSize: 13, fontWeight: '700', color: colors.forestInk },
  goalTitle:   { ...typography.headlineSm, color: colors.forestInk },
  progressTrack: { height: 8, backgroundColor: colors.surfaceContainer, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: colors.forestInk, borderRadius: radius.pill },
  goalMetrics:   {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.input,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricItem:    { flex: 1, alignItems: 'center', gap: 2 },
  metricDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  metricLabel:   { fontSize: 10, fontWeight: '600', color: colors.mutedText, textAlign: 'center', lineHeight: 14 },
  metricValue:   { fontSize: 14, fontWeight: '700', color: colors.forestInk },

  // 8. Recent Earnings
  earningsCard: {
    backgroundColor: colors.panelSage,
    borderRadius: radius.card,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#A4D1AC',
    ...shadows.subtle,
  },
  earningsHeading: { fontSize: 15, fontWeight: '700', color: colors.forestInk },
  earningsRow:     { flexDirection: 'row', gap: 8 },
  earningsItem:    {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.input,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  earningsItemHL:  {
    backgroundColor: colors.panelKeylime,
    borderWidth: 1.5,
    borderColor: colors.forestInk,
  },
  earningsLabel:   { fontSize: 11, fontWeight: '600', color: colors.charcoal },
  earningsLabelHL: { color: colors.forestInk },
  earningsAmt:     { fontSize: 14, fontWeight: '700', color: colors.forestInk },
  earningsAmtHL:   { fontSize: 15 },
  earningsSubtext: { fontSize: 11, fontWeight: '400', color: colors.forestInkSub, opacity: 0.85, lineHeight: 16 },
});

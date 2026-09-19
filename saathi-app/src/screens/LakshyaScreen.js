import React, { useState } from 'react';
import FormModal from '../components/FormModal';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, typography } from '../theme';
import { createGoal, getGoals } from '../services/personBClient.js';
import { buildGoalViewModel } from '../services/viewModels.js';
import { useLiveData } from '../hooks/useLiveData';

// Live from Person B: GET /api/goals. No offline sample data here: if the call fails the screen says so and
// offers a retry, rather than showing a made-up goal.
export default function LakshyaScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [formOpen, setFormOpen] = useState(false);
  const { status, data, error, reload } = useLiveData(getGoals);
  const goal = data ? buildGoalViewModel(data) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t('lakshya.headerTitle')}</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {status === 'loading' && (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={colors.forestInk} />
            <Text style={styles.stateText}>{t('lakshya.loadingGoal')}</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.errorBox} accessibilityRole="alert">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="alert-circle" size={18} color={colors.warningText} />
              <Text style={styles.errorTitle}>{t('lakshya.couldNotLoad')}</Text>
            </View>
            <Text style={styles.errorText}>{error && error.message ? error.message : t('lakshya.checkConnection')}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={reload} activeOpacity={0.8}>
              <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {goal && (
          <View style={styles.goalCard}>
            <View style={styles.goalCardHeader}>
              <View style={styles.goalBadge}>
                <Ionicons name="flag-outline" size={12} color={colors.forestInk} style={{ marginRight: 4 }} />
                <Text style={styles.goalBadgeText}>{t('lakshya.goalBadge')}</Text>
              </View>
              <Text style={styles.goalPercentText}>{goal.pct}% {t('lakshya.done')}</Text>
            </View>

            <Text style={styles.goalMainHeading}>{goal.name}</Text>
            <Text style={styles.goalTargetNotice}>
              {t('lakshya.savedOf', { saved: goal.savedText, target: goal.targetText })}
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${Math.min(goal.pct, 100)}%` }]} />
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t('lakshya.saved')}</Text>
                <Text style={styles.metricValue}>{goal.savedText}</Text>
              </View>
              <View style={[styles.metricItem, styles.metricDivider]}>
                <Text style={styles.metricLabel}>{t('lakshya.target')}</Text>
                <Text style={styles.metricValue}>{goal.targetText}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t('lakshya.toGo')}</Text>
                <Text style={styles.metricValue}>{goal.remainingText}</Text>
              </View>
            </View>

            <Text style={styles.reassuranceText}>
              {goal.reached ? t('lakshya.goalReached') : t('lakshya.stillToGo', { remaining: goal.remainingText })}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.actionButton} onPress={() => setFormOpen(true)} activeOpacity={0.8}>
          <Ionicons name={goal ? 'create-outline' : 'add-circle-outline'} size={18} color={colors.cream} style={{ marginRight: 6 }} />
          <Text style={styles.actionButtonText}>{goal ? t('lakshya.setNewGoal') : t('lakshya.addGoal')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <FormModal
        visible={formOpen}
        title={t('lakshya.modalTitle')}
        fields={[
          { key: 'name', label: t('lakshya.fieldGoalName') },
          { key: 'target', label: t('lakshya.fieldTarget'), keyboardType: 'numeric' },
          { key: 'saved', label: t('lakshya.fieldSaved'), keyboardType: 'numeric' },
        ]}
        onClose={() => setFormOpen(false)}
        onSubmit={async (v) => {
          if (!(v.name || '').trim()) throw new Error(t('lakshya.errorName'));
          const target = Number(v.target);
          if (!(target > 0)) throw new Error(t('lakshya.errorTarget'));
          await createGoal({ name: v.name.trim(), target_amount: target, saved_amount: Number(v.saved) || 0 });
          await reload();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stateBox: {
    backgroundColor: colors.panelKeylime,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
    borderRadius: radius.card,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  stateText: { ...typography.bodyMd, color: colors.charcoal, textAlign: 'center' },
  errorBox: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.card,
    padding: 18,
    gap: 8,
  },
  errorTitle: { fontSize: 14, fontWeight: '700', color: colors.warningText },
  errorText: { fontSize: 13, color: colors.warningText, lineHeight: 18 },
  retryButton: {
    backgroundColor: colors.forestInk,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.button,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  retryButtonText: { color: colors.cream, fontWeight: '700', fontSize: 13 },
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  headerBar: {
    height: 56,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMist,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    ...typography.headlineLg,
    color: colors.forestInk,
  },

  goalCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 20,
    gap: 12,
    ...shadows.subtle,
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelKeylime,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.badge,
  },
  goalBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.forestInk,
  },
  goalPercentText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.forestInk,
  },
  goalMainHeading: {
    ...typography.headlineMd,
    color: colors.forestInk,
  },
  goalTargetNotice: {
    ...typography.bodySm,
    color: colors.mutedText,
    marginTop: -4,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.forestInk,
    borderRadius: radius.pill,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.input,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedText,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.forestInk,
  },
  reassuranceText: {
    ...typography.bodySm,
    color: colors.forestInkSub,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forestInk,
    borderRadius: radius.button,
    paddingVertical: 14,
    ...shadows.card,
  },
  actionButtonText: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: 14,
  },
});

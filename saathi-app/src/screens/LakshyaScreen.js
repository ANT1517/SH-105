import React, { useState } from 'react';
import FormModal from '../components/FormModal';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
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
            <ActivityIndicator size="large" color={theme.colors.forestInk} />
            <Text style={styles.stateText}>{t('lakshya.loadingGoal')}</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.stateBox} accessibilityRole="alert">
            <Text style={styles.stateTitle}>{t('lakshya.couldNotLoad')}</Text>
            <Text style={styles.stateText}>{error && error.message ? error.message : t('lakshya.checkConnection')}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={reload} activeOpacity={0.8}>
              <Text style={styles.retryButtonText}>{t('common.tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {goal && (
          <View style={styles.goalCard}>
            <View style={styles.goalCardHeader}>
              <View style={styles.goalBadge}>
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
              <View style={[styles.progressBarFill, { width: `${goal.pct}%` }]} />
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{t('lakshya.saved')}</Text>
                <Text style={styles.metricValue}>{goal.savedText}</Text>
              </View>
              <View style={styles.metricItem}>
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

        <TouchableOpacity style={styles.retryButton} onPress={() => setFormOpen(true)} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>{goal ? t('lakshya.setNewGoal') : t('lakshya.addGoal')}</Text>
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
    backgroundColor: theme.colors.panelKeylime,
    borderWidth: 1,
    borderColor: theme.colors.hairlineMist,
    borderRadius: theme.radius.card,
    padding: 20,
    gap: 10,
    alignItems: 'center',
  },
  stateTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.forestInk },
  stateText: { fontSize: 13, color: theme.colors.charcoal, textAlign: 'center' },
  retryButton: { backgroundColor: theme.colors.forestInk, paddingHorizontal: 20, paddingVertical: 10, borderRadius: theme.radius.badge },
  retryButtonText: { color: theme.colors.paperCream, fontWeight: '700', fontSize: 14 },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.paperCream,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.paperCream,
  },
  headerBar: {
    minHeight: 56,
    backgroundColor: theme.colors.paperCream,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.panelKeylime,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.forestInk,
    letterSpacing: 0.3,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24, // base; insets.bottom added dynamically above
    gap: 16,
  },
  goalCard: {
    backgroundColor: theme.colors.panelKeylime,
    borderWidth: 1,
    borderColor: theme.colors.hairlineMist,
    borderRadius: theme.radius.card,
    padding: 20,
    gap: 12,
  },
  goalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalBadge: {
    backgroundColor: theme.colors.paperCream,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.badge,
    borderWidth: 1,
    borderColor: theme.colors.hairlineMist,
  },
  goalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.forestInk,
  },
  goalPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.forestInk,
  },
  goalMainHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.forestInk,
  },
  goalTargetNotice: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.charcoal,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: theme.colors.paperCream,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.forestInk,
    borderRadius: theme.radius.full,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.paperCream,
    borderRadius: theme.radius.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.hairlineMist,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.colors.mutedText,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.forestInk,
  },
  reassuranceText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.charcoal,
    lineHeight: 18,
  },
});

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

export default function LakshyaScreen() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Lakshya • Goals</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.goalCard}>
          <View style={styles.goalCardHeader}>
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>Education Goal</Text>
            </View>
            <Text style={styles.goalPercentText}>40% done</Text>
          </View>

          <Text style={styles.goalMainHeading}>Meena's College Fund</Text>
          <Text style={styles.goalTargetNotice}>₹8,000 saved of ₹20,000 target</Text>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: '40%' }]} />
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Saved</Text>
              <Text style={styles.metricValue}>₹8,000</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Target</Text>
              <Text style={styles.metricValue}>₹20,000</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Monthly</Text>
              <Text style={styles.metricValue}>₹2,000/mo</Text>
            </View>
          </View>

          <Text style={styles.reassuranceText}>
            Saving ₹2,000 every month will help you reach your target in 6 months.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

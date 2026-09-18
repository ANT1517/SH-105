import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- STITCH DESIGN TOKENS ("Saathi Botanical") ---
const COLORS = {
  forestInk: '#0F3E17', // Headings, primary text, primary CTAs, positive indicators
  cream: '#FFFEFC', // Screen background, card fills
  keylimeWash: '#E1F4DF', // Badge background, profit highlight card background
  sageMist: '#B1DBB8', // Summary card background, borders
  slateHush: '#B6CED5', // Auxiliary accent
  charcoal: '#222222', // Secondary text
  white: '#FFFFFF',
};

// --- FIXTURE DATA ---
const SUMMARY_DATA = {
  badgeLabel: 'Pickle Sales + Tailoring',
  revenue: '₹1,000',
  cost: '₹600',
  profit: '₹400',
  reassuranceText: 'This sale added ₹400 to your Business pot.',
  ctaText: 'Turn this into a listing',
};

const RECENT_ENTRIES_DATA = [
  {
    id: '1',
    name: 'Pickle sales',
    date: 'Yesterday evening',
    amount: '+₹1,000',
  },
  {
    id: '2',
    name: 'Tailoring order',
    date: 'Yesterday evening',
    amount: '+₹600',
  },
  {
    id: '3',
    name: 'Mango pickle jars (3)',
    date: '2 days ago',
    amount: '+₹350',
  },
];

export default function LedgerScreen() {
  const handleAddEntry = () => {
    console.log('+ Add New Entry pressed');
  };

  const handleTurnIntoListing = () => {
    console.log('Turn this into a listing pressed');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.cream} />

      {/* 1. HEADER */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Business Ledger</Text>
      </View>

      <View style={styles.mainWrapper}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* 2. TOP SUMMARY CARD */}
          <View style={styles.summaryCard}>
            {/* Activity Pill Badge */}
            <View style={styles.activityBadge}>
              <Text style={styles.activityBadgeText}>{SUMMARY_DATA.badgeLabel}</Text>
            </View>

            {/* Figures Row */}
            <View style={styles.figuresRow}>
              <View style={styles.figureItem}>
                <Text style={styles.figureLabel}>Revenue</Text>
                <Text style={styles.figureValue}>{SUMMARY_DATA.revenue}</Text>
              </View>

              <View style={styles.figureItem}>
                <Text style={styles.figureLabel}>Cost</Text>
                <Text style={styles.figureValue}>{SUMMARY_DATA.cost}</Text>
              </View>

              <View style={[styles.figureItem, styles.profitHighlightItem]}>
                <Text style={styles.profitLabel}>Profit</Text>
                <Text style={styles.profitValue}>{SUMMARY_DATA.profit} ↑</Text>
              </View>
            </View>

            {/* Reassurance text */}
            <Text style={styles.reassuranceText}>{SUMMARY_DATA.reassuranceText}</Text>

            {/* Outlined Secondary Action Button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleTurnIntoListing}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>{SUMMARY_DATA.ctaText}</Text>
            </TouchableOpacity>
          </View>

          {/* 3. RECENT ENTRIES LIST SECTION */}
          <View style={styles.entriesSection}>
            <Text style={styles.sectionTitle}>Recent Entries</Text>

            <View style={styles.entriesList}>
              {RECENT_ENTRIES_DATA.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryLeftInfo}>
                    <Text style={styles.entryName}>{entry.name}</Text>
                    <Text style={styles.entryDate}>{entry.date}</Text>
                  </View>
                  <Text style={styles.entryAmount}>{entry.amount}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* 4. FLOATING / BOTTOM ACTION BUTTON */}
        <View style={styles.bottomActionContainer}>
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={handleAddEntry}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryActionButtonText}>+ Add New Entry</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  mainWrapper: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90, // Padding so floating button doesn't cover last item
    gap: 20,
  },

  // 1. Header
  headerBar: {
    height: 56,
    backgroundColor: COLORS.cream,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.keylimeWash,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.forestInk,
    letterSpacing: 0.3,
  },

  // 2. Top Summary Card
  summaryCard: {
    backgroundColor: COLORS.sageMist,
    borderRadius: 14,
    padding: 24,
    gap: 16,
    alignItems: 'flex-start',
  },
  activityBadge: {
    backgroundColor: COLORS.keylimeWash,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  figuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'flex-end',
    gap: 8,
  },
  figureItem: {
    flex: 1,
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  profitHighlightItem: {
    backgroundColor: COLORS.keylimeWash,
    borderWidth: 1.5,
    borderColor: COLORS.forestInk,
  },
  figureLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  profitLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  figureValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  profitValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.forestInk,
  },
  reassuranceText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
    lineHeight: 20,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: COLORS.forestInk,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.forestInk,
  },

  // 3. Recent Entries List Section
  entriesSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  entriesList: {
    gap: 10,
  },
  entryCard: {
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.sageMist,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryLeftInfo: {
    gap: 4,
  },
  entryName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  entryDate: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
    opacity: 0.7,
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.forestInk,
  },

  // 4. Floating / Bottom Action Button
  bottomActionContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  primaryActionButton: {
    backgroundColor: COLORS.forestInk,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.cream,
  },
});

import React from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- STITCH DESIGN TOKENS ("Saathi Botanical") ---
const COLORS = {
  forestInk: '#0F3E17', // Primary text, headings, primary buttons
  cream: '#FFFEFC', // Main background
  keylimeWash: '#E1F4DF', // Secondary surfaces, highlighted notes
  sageMist: '#B1DBB8', // Card backgrounds
  slateHush: '#B6CED5', // Caution/locked states
  charcoal: '#222222', // Secondary text
  white: '#FFFFFF',
  sageBorder: '#9AC9A2',
};

// --- FIXTURE DATA ---
const HEADER_DATA = {
  greeting: 'Namaste, Meera',
};

const HERO_BALANCE_DATA = {
  label: 'Total Money in Your Hands',
  amount: '₹19,500',
  subtext: 'Counted together, all your savings pots are safe',
};

const POTS_DATA = [
  {
    id: '1',
    name: 'Bank',
    subLabel: 'Bank Savings',
    amount: '₹5,000',
    status: 'Ready to use',
  },
  {
    id: '2',
    name: 'Cash',
    subLabel: 'At home or bag',
    amount: '₹2,000',
    status: 'In hand',
  },
  {
    id: '3',
    name: 'SHG Bachat',
    subLabel: 'Monthly meeting',
    amount: '₹2,500',
    status: 'Growing',
  },
  {
    id: '4',
    name: 'Post Office',
    subLabel: 'Post office savings',
    amount: '₹5,000',
    status: 'Steady Growth',
  },
];

const CHIT_DATA = {
  name: 'Chit (Bessoo)',
  amount: '₹4,000',
  status: 'Locked until Oct — cannot spend now',
};

const GENTLE_NOTE_DATA = {
  heading: "Saathi's Gentle Note",
  body: 'Your Chit commitment is ₹4,000 every month. Because that money is locked, we leave it out of cash you can spend right now.',
  buttonText: '🔊 Hear audio explanation (30 sec)',
};

const EDUCATION_GOAL_DATA = {
  title: 'Education Goal',
  savedAmount: 8000,
  targetAmount: 12000,
  savedText: '₹8,000 saved',
  targetText: '₹12,000 target',
  subtext: 'Growing steady',
};

const RECENT_EARNINGS_DATA = {
  heading: 'Recent Earnings — Pickle + Tailoring',
  items: [
    { label: 'Pickle', amount: '₹1,000', isHighlight: false },
    { label: 'Tailoring', amount: '₹600', isHighlight: false },
    { label: 'Profit', amount: '₹400 ↑', isHighlight: true },
  ],
  subtext: 'Updated yesterday evening with Asha didi',
};

export default function MoneyPotMapScreen() {
  const goalProgressPercent =
    (EDUCATION_GOAL_DATA.savedAmount / EDUCATION_GOAL_DATA.targetAmount) * 100;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.cream} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. HEADER ROW */}
        <View style={styles.headerRow}>
          <Text style={styles.greetingText}>{HEADER_DATA.greeting}</Text>
          <TouchableOpacity style={styles.notificationButton} activeOpacity={0.7}>
            <Text style={styles.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* 2. HERO BALANCE CARD */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>{HERO_BALANCE_DATA.label}</Text>
          <Text style={styles.heroAmount}>{HERO_BALANCE_DATA.amount}</Text>
          <Text style={styles.heroSubtext}>{HERO_BALANCE_DATA.subtext}</Text>
        </View>

        {/* 3. YOUR 5 POTS SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your 5 Pots</Text>
          <Text style={styles.sectionSubtitle}>Tap to open</Text>
        </View>

        <View style={styles.potsGrid}>
          {POTS_DATA.map((pot) => (
            <View key={pot.id} style={styles.potCard}>
              <Text style={styles.potName}>{pot.name}</Text>
              <Text style={styles.potSubLabel}>{pot.subLabel}</Text>
              <Text style={styles.potAmount}>{pot.amount}</Text>
              <View style={styles.potStatusPill}>
                <Text style={styles.potStatusText}>{pot.status}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 4. CHIT (LOCKED) CARD */}
        <View style={styles.chitCard}>
          <View style={styles.chitHeaderRow}>
            <Text style={styles.chitName}>{CHIT_DATA.name}</Text>
            <Text style={styles.chitLockBadge}>🔒 Locked</Text>
          </View>
          <Text style={styles.chitAmount}>{CHIT_DATA.amount}</Text>
          <Text style={styles.chitStatus}>{CHIT_DATA.status}</Text>
        </View>

        {/* 5. SAATHI'S GENTLE NOTE CARD */}
        <View style={styles.gentleNoteCard}>
          <View style={styles.gentleNoteHeader}>
            <Text style={styles.gentleNoteIcon}>💬</Text>
            <Text style={styles.gentleNoteHeading}>{GENTLE_NOTE_DATA.heading}</Text>
          </View>
          <Text style={styles.gentleNoteBody}>{GENTLE_NOTE_DATA.body}</Text>
          <TouchableOpacity style={styles.audioButton} activeOpacity={0.7}>
            <Text style={styles.audioButtonText}>{GENTLE_NOTE_DATA.buttonText}</Text>
          </TouchableOpacity>
        </View>

        {/* 6. EDUCATION GOAL CARD */}
        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>{EDUCATION_GOAL_DATA.title}</Text>
          
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(goalProgressPercent, 100)}%` },
              ]}
            />
          </View>

          <View style={styles.goalDetailsRow}>
            <Text style={styles.goalSavedText}>{EDUCATION_GOAL_DATA.savedText}</Text>
            <Text style={styles.goalTargetText}>{EDUCATION_GOAL_DATA.targetText}</Text>
          </View>
          <Text style={styles.goalSubtext}>{EDUCATION_GOAL_DATA.subtext}</Text>
        </View>

        {/* 7. RECENT EARNINGS CARD */}
        <View style={styles.earningsCard}>
          <Text style={styles.earningsHeading}>{RECENT_EARNINGS_DATA.heading}</Text>
          
          <View style={styles.earningsRow}>
            {RECENT_EARNINGS_DATA.items.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.earningsItem,
                  item.isHighlight && styles.earningsItemHighlight,
                ]}
              >
                <Text
                  style={[
                    styles.earningsItemLabel,
                    item.isHighlight && styles.earningsItemLabelHighlight,
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.earningsItemAmount,
                    item.isHighlight && styles.earningsItemAmountHighlight,
                  ]}
                >
                  {item.amount}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.earningsSubtext}>{RECENT_EARNINGS_DATA.subtext}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 42,
    gap: 16,
  },

  // 1. Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  notificationButton: {
    padding: 8,
    backgroundColor: COLORS.keylimeWash,
    borderRadius: 999,
  },
  bellIcon: {
    fontSize: 16,
  },

  // 2. Hero Balance Card
  heroCard: {
    backgroundColor: COLORS.sageMist,
    borderRadius: 14,
    padding: 28,
    alignItems: 'flex-start',
    gap: 8,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.forestInk,
    marginVertical: 4,
  },
  heroSubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.charcoal,
    opacity: 0.9,
  },

  // 3. Section Header & Pots Grid
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.charcoal,
    opacity: 0.7,
  },
  potsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  potCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.sageMist,
    borderRadius: 14,
    padding: 16,
    gap: 4,
    justifyContent: 'space-between',
  },
  potName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  potSubLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
    opacity: 0.8,
  },
  potAmount: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.forestInk,
    marginTop: 6,
    marginBottom: 8,
  },
  potStatusPill: {
    backgroundColor: COLORS.keylimeWash,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  potStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.forestInk,
  },

  // 4. Chit (Locked) Card
  chitCard: {
    backgroundColor: COLORS.slateHush,
    borderRadius: 14,
    padding: 20,
    gap: 6,
  },
  chitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chitName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  chitLockBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  chitAmount: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.forestInk,
    marginVertical: 2,
  },
  chitStatus: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.charcoal,
  },

  // 5. Saathi's Gentle Note
  gentleNoteCard: {
    backgroundColor: COLORS.keylimeWash,
    borderRadius: 14,
    padding: 20,
    gap: 12,
  },
  gentleNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gentleNoteIcon: {
    fontSize: 16,
  },
  gentleNoteHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  gentleNoteBody: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
    lineHeight: 20,
  },
  audioButton: {
    borderWidth: 1.5,
    borderColor: COLORS.forestInk,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  audioButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.forestInk,
  },

  // 6. Education Goal Card
  goalCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.sageMist,
    borderRadius: 14,
    padding: 20,
    gap: 12,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: COLORS.keylimeWash,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.forestInk,
    borderRadius: 999,
  },
  goalDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalSavedText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  goalTargetText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  goalSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
    opacity: 0.8,
  },

  // 7. Recent Earnings Card
  earningsCard: {
    backgroundColor: COLORS.sageMist,
    borderRadius: 14,
    padding: 20,
    gap: 14,
  },
  earningsHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  earningsItem: {
    flex: 1,
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  earningsItemHighlight: {
    backgroundColor: COLORS.keylimeWash,
    borderWidth: 1.5,
    borderColor: COLORS.forestInk,
  },
  earningsItemLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
  },
  earningsItemLabelHighlight: {
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  earningsItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  earningsItemAmountHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.forestInk,
  },
  earningsSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.charcoal,
    opacity: 0.8,
  },
});

import React from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// --- STITCH DESIGN TOKENS ("Saathi Botanical") ---
const COLORS = {
  forestInk: '#0F3E17', // Headings, primary text, primary button fill
  cream: '#FFFEFC', // Screen background, badge background, button text
  keylimeWash: '#E1F4DF', // Explanation card background
  sageMist: '#B1DBB8', // Accent surface
  slateHush: '#B6CED5', // Flagged message background (cool caution tone - no red/orange)
  charcoal: '#222222', // Body text, secondary labels
  white: '#FFFFFF',
  sageBorder: '#9AC9A2',
};

// --- FIXTURE DATA ---
const SAFETY_DATA = {
  warningBadge: '⚠️ Please be careful',
  heading: 'This message looks suspicious',
  flaggedLabel: 'Flagged message',
  flaggedSmsText: 'Your KYC will expire. Click here to verify: bit.ly/xyz123',
  explanationText:
    'This message is asking you to click a link urgently. Real banks do not ask you to verify KYC through a text message link. We cannot be 100% sure, but please do not click this link.',
  rulesHeading: '3 Simple Rules for your safety',
  rules: [
    'Do not tap or open the link',
    'Your bank money is safe right now',
    'Never share your 4 or 6 digit OTP',
  ],
  audioButtonText: '🔊 Hear explanation (30 sec)',
  primaryButtonText: 'I understand, ignore it',
  secondaryButtonText: 'Talk to a Sakhi (helper)',
};

export default function SafetyShieldScreen({ navigation } = {}) {
  const router = useRouter();

  const handleIgnore = () => {
    console.log('I understand, ignore it pressed');
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const handleTalkToSakhi = () => {
    console.log('Talk to a Sakhi pressed');
  };

  const handleAudioExplanation = () => {
    console.log('Hear explanation pressed');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.cream} />

      {/* 1. HEADER */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Safety Shield</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. WARNING PILL BADGE */}
        <View style={styles.warningBadgeContainer}>
          <View style={styles.warningBadge}>
            <Text style={styles.warningBadgeText}>{SAFETY_DATA.warningBadge}</Text>
          </View>
        </View>

        {/* 3. HEADING */}
        <Text style={styles.mainHeading}>{SAFETY_DATA.heading}</Text>

        {/* 4. FLAGGED MESSAGE CARD */}
        <View style={styles.flaggedCard}>
          <Text style={styles.flaggedLabel}>{SAFETY_DATA.flaggedLabel}</Text>
          <View style={styles.quoteBlock}>
            <Text style={styles.flaggedSmsText}>"{SAFETY_DATA.flaggedSmsText}"</Text>
          </View>
        </View>

        {/* 5. EXPLANATION CARD */}
        <View style={styles.explanationCard}>
          <Text style={styles.explanationText}>{SAFETY_DATA.explanationText}</Text>
        </View>

        {/* 6. "3 SIMPLE RULES" SECTION */}
        <View style={styles.rulesSection}>
          <Text style={styles.rulesHeading}>{SAFETY_DATA.rulesHeading}</Text>
          <View style={styles.rulesList}>
            {SAFETY_DATA.rules.map((rule, index) => (
              <View key={index} style={styles.ruleRow}>
                <View style={styles.ruleCheckCircle}>
                  <Text style={styles.ruleCheckIcon}>✓</Text>
                </View>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 7. AUDIO EXPLANATION BUTTON */}
        <TouchableOpacity
          style={styles.audioButton}
          onPress={handleAudioExplanation}
          activeOpacity={0.7}
        >
          <Text style={styles.audioButtonText}>{SAFETY_DATA.audioButtonText}</Text>
        </TouchableOpacity>

        {/* 8. TWO ACTION BUTTONS */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleIgnore}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>{SAFETY_DATA.primaryButtonText}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleTalkToSakhi}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>{SAFETY_DATA.secondaryButtonText}</Text>
          </TouchableOpacity>
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
    paddingBottom: 40,
    gap: 18,
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

  // 2. Warning Pill Badge
  warningBadgeContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  warningBadge: {
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.forestInk,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  warningBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.forestInk,
  },

  // 3. Heading
  mainHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.forestInk,
    textAlign: 'center',
  },

  // 4. Flagged Message Card
  flaggedCard: {
    backgroundColor: COLORS.slateHush,
    borderRadius: 14,
    padding: 20,
    gap: 8,
  },
  flaggedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.charcoal,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  quoteBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    padding: 12,
    borderRadius: 8,
  },
  flaggedSmsText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // 5. Explanation Card
  explanationCard: {
    backgroundColor: COLORS.keylimeWash,
    borderRadius: 14,
    padding: 20,
  },
  explanationText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
    lineHeight: 22,
  },

  // 6. 3 Simple Rules Section
  rulesSection: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.sageMist,
    borderRadius: 14,
    padding: 20,
    gap: 14,
  },
  rulesHeading: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  rulesList: {
    gap: 12,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: COLORS.keylimeWash,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleCheckIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forestInk,
  },
  ruleText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
    flex: 1,
  },

  // 7. Audio Explanation Button
  audioButton: {
    borderWidth: 1.5,
    borderColor: COLORS.forestInk,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  audioButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.forestInk,
  },

  // 8. Action Buttons
  actionButtonsContainer: {
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: COLORS.forestInk,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.cream,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: COLORS.forestInk,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
});

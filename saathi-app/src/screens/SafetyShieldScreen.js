import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { checkSafety } from '../services/personCClient.js';
import { looksSuspicious } from '../services/safetyTrigger.js';

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

// Static safe-habit reminders: true for every message, so they are shown regardless of the result. The actual
// verdict and explanation for the message always come from Person C (POST /api/v1/safety/check).
const SAFE_HABITS = {
  heading: '3 Simple Rules for your safety',
  rules: [
    'Do not tap or open links in messages you did not expect',
    'Never share your OTP, PIN or password with anyone',
    'Check with your bank using its official app or phone number',
  ],
};

export default function SafetyShieldScreen({ navigation } = {}) {
  const router = useRouter();
  // When opened from Chat ("See why & what to do") the checked message arrives as ?message=... and, since Chat
  // already has Person C's reply for it, that reply as ?result=... (so we don't run a second LLM call).
  const params = useLocalSearchParams();
  const initialMessage = typeof params.message === 'string' ? params.message : '';
  const initialResult = typeof params.result === 'string' ? params.result : '';

  const [input, setInput] = useState(initialMessage);
  const [checked, setChecked] = useState(initialResult ? initialMessage.trim() : ''); // the exact message that was checked
  const [status, setStatus] = useState(initialResult ? 'done' : 'idle');            // 'idle' | 'checking' | 'done' | 'error'
  const [resultText, setResultText] = useState(initialResult);
  const [errorText, setErrorText] = useState('');

  const runCheck = useCallback(async (message) => {
    const text = (message || '').trim();
    if (!text) return;
    setStatus('checking');
    setChecked(text);
    setResultText('');
    setErrorText('');
    try {
      const reply = await checkSafety({ message: text });
      setResultText(reply.text);
      setStatus('done');
    } catch (err) {
      setErrorText(err && err.message ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, []);

  // A message handed over without a result is checked immediately.
  useEffect(() => {
    if (initialMessage.trim() && !initialResult) runCheck(initialMessage);
  }, [initialMessage, initialResult, runCheck]);

  const handleIgnore = () => {
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  const handleTalkToSakhi = () => {
    router.push('/explore');
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
        keyboardShouldPersistTaps="handled"
      >
        {/* 2. PASTE-IN CHECK */}
        <View style={styles.warningBadgeContainer}>
          <View style={styles.warningBadge}>
            <Text style={styles.warningBadgeText}>🛡️ Check a message</Text>
          </View>
        </View>

        <Text style={styles.mainHeading}>Not sure about a message?</Text>

        <View style={styles.inputCard}>
          <Text style={styles.flaggedLabel}>Paste the message here</Text>
          <TextInput
            style={styles.messageInput}
            value={input}
            onChangeText={setInput}
            placeholder="e.g. a SMS or WhatsApp message you are unsure about"
            placeholderTextColor="#666666"
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.checkButton, (!input.trim() || status === 'checking') && styles.checkButtonDisabled]}
            onPress={() => runCheck(input)}
            disabled={!input.trim() || status === 'checking'}
            activeOpacity={0.8}
          >
            <Text style={styles.checkButtonText}>{status === 'checking' ? 'Checking...' : 'Check this message'}</Text>
          </TouchableOpacity>
        </View>

        {/* 3. RESULT: everything below comes from Person C */}
        {status === 'checking' && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={COLORS.forestInk} />
            <Text style={styles.loadingText}>Saathi is checking this message...</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.errorCard} accessibilityRole="alert">
            <Text style={styles.errorTitle}>Couldn't run the safety check</Text>
            <Text style={styles.errorText}>
              Saathi could not reach the safety service, so I can't say whether this message is safe. Please do not
              tap any links in it until you have checked another way.
            </Text>
            <Text style={styles.errorDetail}>{errorText}</Text>
          </View>
        )}

        {status === 'done' && (
          <>
            <View style={styles.flaggedCard}>
              <Text style={styles.flaggedLabel}>Message checked</Text>
              <View style={styles.quoteBlock}>
                <Text style={styles.flaggedSmsText}>"{checked}"</Text>
              </View>
            </View>

            {/* Verdict from the same scam-pattern rules Person C uses (deterministic, not the LLM). */}
            <View style={[styles.verdictBadge, { backgroundColor: looksSuspicious(checked) ? '#FDE2E2' : '#E1F4DF' }]}>
              <Text style={styles.verdictText}>
                {looksSuspicious(checked)
                  ? '⚠️ Looks like a scam. Do not pay, share OTPs or tap links.'
                  : '✅ No known scam pattern found. Still be careful with unknown senders.'}
              </Text>
            </View>

            <View style={styles.explanationCard}>
              <Text style={styles.explanationText}>{resultText}</Text>
            </View>
          </>
        )}

        {/* 4. SAFE-HABIT REMINDERS */}
        <View style={styles.rulesSection}>
          <Text style={styles.rulesHeading}>{SAFE_HABITS.heading}</Text>
          <View style={styles.rulesList}>
            {SAFE_HABITS.rules.map((rule, index) => (
              <View key={index} style={styles.ruleRow}>
                <View style={styles.ruleCheckCircle}>
                  <Text style={styles.ruleCheckIcon}>✓</Text>
                </View>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 5. AUDIO EXPLANATION BUTTON (not wired yet) */}

        {/* 6. TWO ACTION BUTTONS */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleIgnore}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>I understand, ignore it</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleTalkToSakhi}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Talk to a Sakhi (helper)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  verdictBadge: { borderRadius: 12, padding: 14 },
  verdictText: { fontSize: 15, fontWeight: '700', color: '#222222' },
  inputCard: {
    backgroundColor: COLORS.keylimeWash,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  messageInput: {
    minHeight: 96,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.sageBorder,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.charcoal,
  },
  checkButton: {
    backgroundColor: COLORS.forestInk,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  checkButtonDisabled: { opacity: 0.45 },
  checkButtonText: { color: COLORS.cream, fontSize: 15, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  loadingText: { fontSize: 14, color: COLORS.charcoal },
  errorCard: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 14, padding: 16, gap: 6 },
  errorTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  errorText: { fontSize: 14, color: '#92400E', lineHeight: 20 },
  errorDetail: { fontSize: 11, color: '#92400E', opacity: 0.8 },
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

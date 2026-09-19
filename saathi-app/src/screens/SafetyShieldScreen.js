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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { checkSafety } from '../services/personCClient.js';
import { looksSuspicious } from '../services/safetyTrigger.js';
import { colors, radius, shadows, typography } from '../theme';

export default function SafetyShieldScreen({ navigation } = {}) {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const initialMessage = typeof params.message === 'string' ? params.message : '';
  const initialResult = typeof params.result === 'string' ? params.result : '';

  const [input, setInput] = useState(initialMessage);
  const [checked, setChecked] = useState(initialResult ? initialMessage.trim() : '');
  const [status, setStatus] = useState(initialResult ? 'done' : 'idle');
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* 1. HEADER */}
      <View style={styles.headerBar}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="shield-checkmark" size={20} color={colors.forestInk} style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>{t('safetyShield.headerTitle')}</Text>
        </View>
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
            <Ionicons name="search-outline" size={13} color={colors.forestInk} style={{ marginRight: 5 }} />
            <Text style={styles.warningBadgeText}>{t('safetyShield.checkBadge')}</Text>
          </View>
        </View>

        <Text style={styles.mainHeading}>{t('safetyShield.heading')}</Text>

        <View style={styles.inputCard}>
          <Text style={styles.flaggedLabel}>{t('safetyShield.inputLabel')}</Text>
          <TextInput
            style={styles.messageInput}
            value={input}
            onChangeText={setInput}
            placeholder={t('safetyShield.inputPlaceholder')}
            placeholderTextColor="#7D8880"
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
            <Text style={styles.checkButtonText}>{status === 'checking' ? t('safetyShield.checking') : t('safetyShield.checkButton')}</Text>
          </TouchableOpacity>
        </View>

        {/* 3. RESULT: everything below comes from Person C */}
        {status === 'checking' && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.forestInk} />
            <Text style={styles.loadingText}>{t('safetyShield.checkingText')}</Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.errorCard} accessibilityRole="alert">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="alert-circle" size={18} color={colors.warningText} />
              <Text style={styles.errorTitle}>{t('safetyShield.couldNotCheck')}</Text>
            </View>
            <Text style={styles.errorText}>
              {t('safetyShield.errorWarning')}
            </Text>
            {errorText ? <Text style={styles.errorDetail}>{errorText}</Text> : null}
          </View>
        )}

        {status === 'done' && (
          <>
            <View style={styles.flaggedCard}>
              <Text style={styles.flaggedLabel}>{t('safetyShield.messageChecked')}</Text>
              <View style={styles.quoteBlock}>
                <Text style={styles.flaggedSmsText}>"{checked}"</Text>
              </View>
            </View>

            {/* Verdict from the same scam-pattern rules Person C uses (deterministic, not the LLM). */}
            <View style={[styles.verdictBadge, { backgroundColor: looksSuspicious(checked) ? '#FDE2E2' : '#E1F4DF' }]}>
              <Text style={styles.verdictText}>
                {looksSuspicious(checked) ? t('safetyShield.verdictScam') : t('safetyShield.verdictClear')}
              </Text>
            </View>

            <View style={styles.explanationCard}>
              <Text style={styles.explanationText}>{resultText}</Text>
            </View>
          </>
        )}

        {/* 4. SAFE-HABIT REMINDERS */}
        <View style={styles.rulesSection}>
          <Text style={styles.rulesHeading}>{t('safetyShield.rulesHeading')}</Text>
          <View style={styles.rulesList}>
            {[t('safetyShield.rule1'), t('safetyShield.rule2'), t('safetyShield.rule3')].map((rule, index) => (
              <View key={index} style={styles.ruleRow}>
                <View style={styles.ruleCheckCircle}>
                  <Ionicons name="checkmark" size={13} color={colors.forestInk} />
                </View>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 5. TWO ACTION BUTTONS */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleIgnore}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>{t('safetyShield.ignoreButton')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleTalkToSakhi}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>{t('safetyShield.talkSakhiButton')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: 14,
    paddingBottom: 40,
    gap: 16,
  },

  // 1. Header
  headerBar: {
    height: 56,
    backgroundColor: colors.cream,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMist,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.headlineLg,
    color: colors.forestInk,
  },

  // 2. Warning Pill Badge
  warningBadgeContainer: {
    alignItems: 'center',
    marginTop: 2,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panelKeylime,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.badge,
  },
  warningBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.forestInk,
  },

  // 3. Heading
  mainHeading: {
    ...typography.headlineMd,
    fontSize: 19,
    color: colors.forestInk,
    textAlign: 'center',
    paddingHorizontal: 10,
  },

  inputCard: {
    backgroundColor: colors.panelKeylime,
    borderRadius: radius.card,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
    ...shadows.subtle,
  },
  flaggedLabel: {
    ...typography.labelSm,
    color: colors.forestSubtle,
    letterSpacing: 0.6,
  },
  messageInput: {
    minHeight: 90,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    padding: 12,
    fontSize: 14,
    color: colors.charcoal,
    lineHeight: 20,
  },
  checkButton: {
    backgroundColor: colors.forestInk,
    borderRadius: radius.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  checkButtonDisabled: { opacity: 0.45 },
  checkButtonText: { color: colors.cream, fontSize: 14, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 8 },
  loadingText: { ...typography.bodyMd, color: colors.charcoal },
  errorCard: {
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: radius.card,
    padding: 16,
    gap: 6,
  },
  errorTitle: { fontSize: 14, fontWeight: '700', color: colors.warningText },
  errorText: { fontSize: 13, color: colors.warningText, lineHeight: 19 },
  errorDetail: { fontSize: 11, color: colors.warningText, opacity: 0.8 },

  // 4. Flagged Message Card
  flaggedCard: {
    backgroundColor: colors.slateHush,
    borderRadius: radius.card,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: '#B4CAD1',
    ...shadows.subtle,
  },
  quoteBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 12,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.forestInk,
  },
  flaggedSmsText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.charcoal,
    lineHeight: 19,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // 5. Explanation Card
  verdictBadge: { borderRadius: 12, padding: 14 },
  verdictText: { fontSize: 15, fontWeight: '700', color: '#222222' },
  explanationCard: {
    backgroundColor: colors.panelKeylime,
    borderRadius: radius.card,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
    ...shadows.subtle,
  },
  explanationText: {
    ...typography.bodyMd,
    color: colors.charcoal,
    lineHeight: 22,
  },

  // 6. Rules Section
  rulesSection: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 18,
    gap: 12,
    ...shadows.subtle,
  },
  rulesHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.forestInk,
  },
  rulesList: {
    gap: 10,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ruleCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.panelKeylime,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleText: {
    ...typography.bodyMd,
    color: colors.charcoal,
    flex: 1,
  },

  // 7. Action Buttons
  actionButtonsContainer: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: colors.forestInk,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.cream,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.forestInk,
    borderRadius: radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.forestInk,
  },
});

import React, { useRef, useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { handleUserMessage } from '../services/messageRouter.js';
import { formatINR } from '../services/viewModels.js';
import { guessAudioMeta, transcribeAudio } from '../services/voiceClient.js';
import { appendAudio } from '../services/voiceRuntime'; // platform adapter: a File on native, a Blob on web
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, typography } from '../theme';

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  forestInk: '#0F3E17',
  cream:     '#FFFEFC',
  keylime:   '#E1F4DF',
  mint:      '#CFE7D3',
  sage:      '#B1DBB8',
  slate:     '#B6CED5',
  charcoal:  '#222222',
  white:     '#FFFFFF',
  border:    '#EFEEEB',
  errorBg:   '#FDE8E8',
  errorText: '#9B1C1C',
  amberBg:   '#FEF3C7',
  amberBorder: '#FDE68A',
  amberText: '#92400E',
  infoBg:    '#EFF6FF',
  infoBorder:'#BFDBFE',
  infoText:  '#1E40AF',
};

// No canned conversation: the list starts empty and every Saathi message is a real reply from Person B (recording
// confirmation) or Person C (guidance / safety), or an honest failure message. See services/messageRouter.js.

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'thinking' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);

  // A ref (not state) so two taps / Enter+click in the same tick cannot both pass the guard.
  const sendingRef = useRef(false);

  const voice = useVoiceRecorder();
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'recording' | 'transcribing'

  // `spoken` is the Whisper transcript when this message came from the mic; otherwise the typed text is sent.
  // (Button/Enter handlers pass an event object, which has no `spoken`.)
  const handleSend = async ({ spoken } = {}) => {
    const userText = (typeof spoken === 'string' ? spoken : inputText).trim();
    if (!userText || status === 'thinking' || sendingRef.current) return;
    sendingRef.current = true;
    const messageType = typeof spoken === 'string' ? 'voice' : 'text';

    const userTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessageId = Date.now().toString();

    const newUserMessage = {
      id: userMessageId,
      sender: 'user',
      type: messageType,
      text: userText,
      timestamp: userTimestamp,
    };

    // 1. Add user's message immediately & 2. clear input & 3. show thinking state
    setMessages((prev) => [...prev, newUserMessage]);
    if (messageType === 'text') setInputText('');
    setStatus('thinking');
    setErrorMessage(null);

    try {
      // Route it: safety check first, then transaction -> Person B, otherwise question -> Person C.
      // Pass language so Person C replies in the user's selected UI language.
      const result = await handleUserMessage(userText, { language, t });

      const saathiMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'saathi',
        type: 'text',
        text: result.text,
        kind: result.kind,
        isError: result.kind === 'error',
        recorded: result.recorded,
        flaggedMessage: result.kind === 'safety' ? userText : undefined,
        nlpMeta: result.nlp, // real NLP metadata (intent, entities, language, confidence), when NLP ran
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, saathiMessage]);
      setStatus(result.kind === 'error' ? 'error' : 'success');
    } catch (err) {
      console.warn('[ChatScreen] unexpected failure:', err && err.message);
      setStatus('error');
      setErrorMessage(t('chat.generalError'));
    } finally {
      sendingRef.current = false;
    }
  };

  // Mic button: tap to start recording, tap again to stop. The audio goes to Dev-A's Whisper (the same model the
  // WhatsApp bot uses) and the transcript is sent through the normal routing (safety check first) like typed text.
  const handleMic = async () => {
    if (voiceState === 'transcribing' || status === 'thinking') return;

    if (voiceState === 'recording') {
      setVoiceState('transcribing');
      setErrorMessage(null);
      try {
        const uri = await voice.stop();
        const transcript = await transcribeAudio({ uri, ...guessAudioMeta(uri) }, { appendAudio });
        if (!transcript) {
          setStatus('error');
          setErrorMessage(t('chat.voiceGenericError'));
        } else {
          await handleSend({ spoken: transcript });
        }
      } catch (err) {
        console.warn('[ChatScreen] voice failed:', err && err.message);
        setStatus('error');
        setErrorMessage(
          err && err.isNetworkError
            ? t('chat.voiceNetworkError')
            : t('chat.voiceTranscribeError', { error: err && err.message ? err.message : 'unknown error', defaultValue: `I couldn't turn that recording into text (${err && err.message ? err.message : 'unknown error'}). Nothing was recorded.` }),
        );
      } finally {
        setVoiceState('idle');
      }
      return;
    }

    setErrorMessage(null);
    const started = await voice.start();
    if (started) {
      setVoiceState('recording');
    } else {
      setStatus('error');
      setErrorMessage(voice.error || t('chat.micStartError', { defaultValue: 'Could not start recording.' }));
    }
  };

  const renderMessageItem = ({ item, index }) => {
    const isUser = item.sender === 'user';

    return (
      <View key={item.id}>
        {/* ── Chat bubble ─────────────────────────────────────────────── */}
        <View style={[styles.messageRow, isUser ? styles.userRow : styles.saathiRow]}>
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.saathiBubble, item.isError && styles.errorSaathiBubble]}>
            {!isUser && <Text style={styles.senderLabel}>Saathi</Text>}

            {item.type === 'voice' ? (
              <View style={styles.voiceContainer}>
                <View style={styles.voiceBadge}>
                  <Ionicons name="mic" size={13} color={colors.cream} style={{ marginRight: 4 }} />
                  {item.duration ? <Text style={styles.voiceDuration}>{item.duration}</Text> : null}
                </View>
                <Text style={styles.userBubbleText}>"{item.text}"</Text>
              </View>
            ) : (
              <Text style={isUser ? styles.userBubbleText : styles.saathiBubbleText}>
                {item.text}
              </Text>
            )}

            <Text style={isUser ? styles.userTimestamp : styles.saathiTimestamp}>
              {item.timestamp}
            </Text>
          </View>
        </View>

        {/* ── Recorded transaction: card built from Person B's own response ─────── */}
        {!isUser && item.kind === 'recorded' && item.recorded && (
          <View style={styles.confirmCardWrap}>
            <View style={styles.confirmCard}>
              <View style={styles.confirmCardTop}>
                <View style={styles.confirmPill}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.forestInk} style={{ marginRight: 4 }} />
                  <Text style={styles.confirmPillText}>
                    {t(`pots.${item.recorded.pot}.name`, { defaultValue: item.recorded.pot.charAt(0).toUpperCase() + item.recorded.pot.slice(1).replace(/_/g, ' ') })} {t('transactions.pot', { name: '', defaultValue: 'Pot' }).trim()}
                  </Text>
                </View>
                <Text style={styles.confirmAmount}>
                  {['expense', 'commitment'].includes(item.recorded.type) ? '−' : '+'}{formatINR(item.recorded.amount)}
                </Text>
              </View>
              <Text style={styles.confirmLine}>
                {t(`transactions.type.${item.recorded.type}`, { defaultValue: item.recorded.type.charAt(0).toUpperCase() + item.recorded.type.slice(1) })} • {item.recorded.category}
              </Text>
              {item.recorded.totalBalance != null && (
                <>
                  <View style={styles.confirmDivider} />
                  <View style={styles.confirmTotalRow}>
                    <Text style={styles.confirmTotalLabel}>{t('chat.runningTotal')}</Text>
                    <Text style={styles.confirmTotalValue}>{formatINR(item.recorded.totalBalance)}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* ── Safety check: link to the full Safety Shield with Person C's result ── */}
        {!isUser && item.kind === 'safety' && item.flaggedMessage && (
          <View style={styles.alertCardContainer}>
            <View style={styles.alertCard}>
              <View style={styles.alertCardHeader}>
                <Text style={styles.alertCardBadge}>{t('chat.safetyCheck')}</Text>
              </View>
              <View style={styles.alertCardBody}>
                <Text style={styles.alertCardLabel}>{t('chat.messageChecked')}</Text>
                <Text style={styles.alertCardSms}>"{item.flaggedMessage}"</Text>
              </View>
              <TouchableOpacity
                style={styles.seeWhyButton}
                onPress={() =>
                  router.push(
                    `/safetyshield?message=${encodeURIComponent(item.flaggedMessage)}&result=${encodeURIComponent(item.text.replace(/^Safety check: /, ''))}`,
                  )
                }
                activeOpacity={0.8}
              >
                <Text style={styles.seeWhyButtonText}>{t('common.seeWhy')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Compact NLP Understanding Card (for real NLP replies) ─── */}
        {!isUser && item.nlpMeta && (
          <View style={styles.understandingCardWrap}>
            {/* Confidence Tier 1: Normal Understanding (>= 0.85) */}
            {item.nlpMeta.confidence >= 0.85 && (
              <View style={styles.understandingCard}>
                <View style={styles.understandingHeader}>
                  <Text style={styles.understandingTitle}>{t('chat.understood')}</Text>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {Math.round((item.nlpMeta.confidence || 0) * 100)}%
                    </Text>
                  </View>
                </View>

                {item.nlpMeta.transaction ? (
                  <View style={styles.understandingDetailsRow}>
                    <Text style={styles.understandingTag}>
                      {item.nlpMeta.transaction.type ? item.nlpMeta.transaction.type.charAt(0).toUpperCase() + item.nlpMeta.transaction.type.slice(1) : 'Transaction'}
                    </Text>
                    {item.nlpMeta.transaction.amount != null && (
                      <>
                        <Text style={styles.understandingBullet}>•</Text>
                        <Text style={styles.understandingTagBold}>₹{item.nlpMeta.transaction.amount}</Text>
                      </>
                    )}
                    {item.nlpMeta.transaction.category && (
                      <>
                        <Text style={styles.understandingBullet}>•</Text>
                        <Text style={styles.understandingTag}>
                          {item.nlpMeta.transaction.category.charAt(0).toUpperCase() + item.nlpMeta.transaction.category.slice(1)}
                        </Text>
                      </>
                    )}
                  </View>
                ) : (
                  <View style={styles.understandingDetailsRow}>
                    <Text style={styles.understandingTag}>
                      {item.nlpMeta.intent ? item.nlpMeta.intent.replace(/_/g, ' ') : 'Query'}
                    </Text>
                  </View>
                )}

                <View style={styles.understandingMetaRow}>
                  <Text style={styles.understandingMetaText}>
                    {t('chat.detectedLanguage', { defaultValue: 'Language' })}: {
                      item.nlpMeta.language === 'en' ? 'English' :
                      item.nlpMeta.language === 'hi' ? 'Hindi' :
                      item.nlpMeta.language === 'te' ? 'Telugu' :
                      item.nlpMeta.language === 'kn' ? 'Kannada' :
                      item.nlpMeta.language === 'mixed' ? 'Mixed' : item.nlpMeta.language
                    }
                  </Text>
                </View>
              </View>
            )}

            {/* Confidence Tier 2: Confirmation Needed (0.60 to 0.84) */}
            {item.nlpMeta.confidence >= 0.60 && item.nlpMeta.confidence < 0.85 && (
              <View style={styles.confirmingCard}>
                <View style={styles.understandingHeader}>
                  <Text style={styles.confirmingTitle}>{t('chat.wantsToConfirm')}</Text>
                  <View style={styles.confirmingBadge}>
                    <Text style={styles.confirmingBadgeText}>
                      {Math.round((item.nlpMeta.confidence || 0) * 100)}%
                    </Text>
                  </View>
                </View>

                {item.nlpMeta.transaction ? (
                  <View style={styles.understandingDetailsRow}>
                    <Text style={styles.confirmingTag}>
                      {item.nlpMeta.transaction.type ? item.nlpMeta.transaction.type.charAt(0).toUpperCase() + item.nlpMeta.transaction.type.slice(1) : 'Transaction'}
                    </Text>
                    {item.nlpMeta.transaction.amount != null && (
                      <>
                        <Text style={styles.understandingBullet}>•</Text>
                        <Text style={styles.confirmingTagBold}>₹{item.nlpMeta.transaction.amount}</Text>
                      </>
                    )}
                    {item.nlpMeta.transaction.category && (
                      <>
                        <Text style={styles.understandingBullet}>•</Text>
                        <Text style={styles.confirmingTag}>
                          {item.nlpMeta.transaction.category.charAt(0).toUpperCase() + item.nlpMeta.transaction.category.slice(1)}
                        </Text>
                      </>
                    )}
                  </View>
                ) : (
                  <View style={styles.understandingDetailsRow}>
                    <Text style={styles.confirmingTag}>
                      {item.nlpMeta.intent ? item.nlpMeta.intent.replace(/_/g, ' ') : 'Query'}
                    </Text>
                  </View>
                )}

                <View style={styles.understandingMetaRow}>
                  <Text style={styles.confirmingMetaText}>
                    Language: {
                      item.nlpMeta.language === 'en' ? 'English' :
                      item.nlpMeta.language === 'hi' ? 'Hindi' :
                      item.nlpMeta.language === 'te' ? 'Telugu' :
                      item.nlpMeta.language === 'mixed' ? 'Mixed' : item.nlpMeta.language
                    } • {t('chat.tapToAdjust')}
                  </Text>
                </View>
              </View>
            )}

            {/* Confidence Tier 3: Clarification Needed (< 0.60) */}
            {item.nlpMeta.confidence < 0.60 && (
              <View style={styles.clarifyCard}>
                <View style={styles.understandingHeader}>
                  <Text style={styles.clarifyTitle}>{t('chat.clarificationNeeded')}</Text>
                  <View style={styles.clarifyBadge}>
                    <Text style={styles.clarifyBadgeText}>
                      {Math.round((item.nlpMeta.confidence || 0) * 100)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.clarifySubtext}>
                  {t('chat.clarificationSubtext')}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={C.cream} />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerEyebrow}>{t('chat.headerEyebrow')}</Text>
          <Text style={styles.headerTitle}>{t('chat.headerTitle')}</Text>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{t('common.active')}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* ── MESSAGE LIST ────────────────────────────────────────────── */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{t('chat.emptyTitle')}</Text>
              <Text style={styles.emptyText}>
                {t('chat.emptyText')}
              </Text>
            </View>
          }
          ListFooterComponent={
            <>
              {status === 'thinking' && (
                <View style={styles.thinkingContainer}>
                  <View style={styles.thinkingBubble}>
                    <ActivityIndicator size="small" color={C.forestInk} />
                    <Text style={styles.thinkingText}>{t('chat.thinking')}</Text>
                  </View>
                </View>
              )}

              {status === 'error' && errorMessage && (
                <View style={styles.errorContainer}>
                  <View style={styles.errorBubble}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.errorText} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                </View>
              )}
            </>
          }
        />

        {/* ── BOTTOM INPUT BAR ─────────────────────────────────────────── */}
        <View style={[styles.inputBarContainer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder={voiceState === 'recording' ? t('chat.listening') : t('chat.placeholder')}
              placeholderTextColor="#7D8880"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
            />
            {inputText.trim().length > 0 ? (
              <TouchableOpacity style={styles.actionButton} onPress={handleSend} activeOpacity={0.8}>
                <Ionicons name="arrow-up" size={18} color={colors.cream} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, voiceState === 'recording' && styles.actionButtonRecording]}
                onPress={handleMic}
                disabled={voiceState === 'transcribing'}
                activeOpacity={0.8}
                accessibilityLabel={voiceState === 'recording' ? t('chat.stopRecording') : t('chat.speakToSaathi')}
              >
                {voiceState === 'transcribing' ? (
                  <ActivityIndicator size="small" color={colors.cream} />
                ) : (
                  <Ionicons name={voiceState === 'recording' ? 'stop' : 'mic'} size={18} color={colors.cream} />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  errorSaathiBubble: { backgroundColor: C.errorBg },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.forestInk },
  emptyText: { fontSize: 14, color: C.charcoal, textAlign: 'center', lineHeight: 20 },
  safeArea:  { flex: 1, backgroundColor: C.cream },
  container: { flex: 1, backgroundColor: C.cream },

  // Header
  headerBar:    { backgroundColor: C.cream, borderBottomWidth: 1, borderBottomColor: C.keylime, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  headerEyebrow:{ fontSize: 10, fontWeight: '600', color: C.forestInk, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: C.forestInk },
  onlineBadge:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.keylime, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, gap: 6 },
  onlineDot:    { width: 7, height: 7, borderRadius: 999, backgroundColor: C.forestInk },
  onlineText:   { fontSize: 12, fontWeight: '600', color: C.forestInk },

  // Message list
  listContent:  { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  messageRow:   { flexDirection: 'row', marginVertical: 2 },
  userRow:      { justifyContent: 'flex-end' },
  saathiRow:    { justifyContent: 'flex-start' },
  messageBubble:{ maxWidth: '82%', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  userBubble:   { backgroundColor: C.forestInk, borderBottomRightRadius: 2 },
  saathiBubble: { backgroundColor: C.keylime, borderBottomLeftRadius: 2 },
  senderLabel:  { fontSize: 11, fontWeight: '700', color: C.forestInk, marginBottom: 2 },
  userBubbleText:  { fontSize: 14, fontWeight: '500', color: C.cream, lineHeight: 20 },
  saathiBubbleText:{ fontSize: 14, fontWeight: '400', color: C.charcoal, lineHeight: 20 },
  voiceContainer: { gap: 6 },
  voiceBadge:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, alignSelf: 'flex-start', gap: 6 },
  waveformIcon: { fontSize: 12 },
  voiceDuration:{ fontSize: 12, fontWeight: '600', color: C.cream },
  userTimestamp:  { fontSize: 10, fontWeight: '500', color: C.cream, opacity: 0.7, alignSelf: 'flex-end', marginTop: 2 },
  saathiTimestamp:{ fontSize: 10, fontWeight: '500', color: C.charcoal, opacity: 0.6, alignSelf: 'flex-end', marginTop: 2 },

  // Business Pot Confirmation Card (after message 2)
  confirmCardWrap: { marginTop: 10, marginBottom: 4 },
  confirmCard:  { backgroundColor: C.mint, borderRadius: 14, padding: 16, gap: 8 },
  confirmCardTop:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confirmPill:  { backgroundColor: C.cream, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#C8EDCA' },
  confirmPillText:{ fontSize: 12, fontWeight: '600', color: C.forestInk },
  confirmAmount:{ fontSize: 22, fontWeight: '700', color: C.forestInk },
  confirmLine:  { fontSize: 12, fontWeight: '400', color: C.charcoal },
  confirmDivider:{ height: 1, backgroundColor: C.border },
  confirmTotalRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confirmTotalLabel:{ fontSize: 12, fontWeight: '500', color: C.charcoal },
  confirmTotalValue:{ fontSize: 14, fontWeight: '700', color: C.forestInk },

  // Suspicious SMS Alert Card
  alertCardContainer: { marginTop: 10, marginBottom: 4 },
  alertCard:    { backgroundColor: C.slate, borderRadius: 14, padding: 16, gap: 10 },
  alertCardHeader:{ flexDirection: 'row', alignItems: 'center' },
  alertCardBadge: { fontSize: 13, fontWeight: '700', color: C.forestInk },
  alertCardBody:{ gap: 4, backgroundColor: 'rgba(255,255,255,0.45)', padding: 12, borderRadius: 8 },
  alertCardLabel: { fontSize: 11, fontWeight: '600', color: C.charcoal, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.8 },
  alertCardSms: { fontSize: 13, fontWeight: '600', color: C.forestInk, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  alertCardDesc:{ fontSize: 12, fontWeight: '400', color: C.charcoal, marginTop: 2, lineHeight: 16 },
  seeWhyButton: { backgroundColor: C.forestInk, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', alignSelf: 'flex-start' },
  seeWhyButtonText: { fontSize: 13, fontWeight: '600', color: C.cream },

  // Education Goal Card (after message 4)
  eduCardWrap:  { marginTop: 10 },
  eduCard:      { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.sage, borderRadius: 14, padding: 18, gap: 12 },
  eduCardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eduBadge:     { backgroundColor: C.keylime, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
  eduBadgeText: { fontSize: 12, fontWeight: '600', color: C.forestInk },
  eduPctText:   { fontSize: 13, fontWeight: '700', color: C.forestInk },
  eduTitle:     { fontSize: 16, fontWeight: '700', color: C.forestInk },
  eduSubtext:   { fontSize: 12, fontWeight: '400', color: C.charcoal, lineHeight: 17 },
  eduProgressTrack: { height: 8, backgroundColor: C.keylime, borderRadius: 999, overflow: 'hidden' },
  eduProgressFill:  { height: '100%', backgroundColor: C.forestInk, borderRadius: 999 },
  eduMetrics:   { flexDirection: 'row', gap: 8 },
  eduMetricItem:{ flex: 1, backgroundColor: C.keylime, borderRadius: 10, padding: 10, alignItems: 'center', gap: 2 },
  eduMetricLabel:{ fontSize: 11, fontWeight: '500', color: C.charcoal },
  eduMetricValue:{ fontSize: 14, fontWeight: '700', color: C.forestInk },
  eduPrimaryBtn:{ backgroundColor: C.forestInk, borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  eduPrimaryBtnText: { fontSize: 13, fontWeight: '600', color: C.cream },
  eduSecondaryBtn:{ borderWidth: 1.5, borderColor: C.forestInk, borderRadius: 999, paddingVertical: 11, alignItems: 'center', backgroundColor: 'transparent' },
  eduSecondaryBtnText: { fontSize: 13, fontWeight: '600', color: C.forestInk },

  // Input bar
  inputBarContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: C.cream, borderTopWidth: 1, borderTopColor: C.keylime },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.keylime, borderRadius: 999, paddingLeft: 18, paddingRight: 6, paddingVertical: 6 },
  textInput:    { flex: 1, fontSize: 14, fontWeight: '500', color: C.charcoal, paddingVertical: 8 },
  actionButton: { width: 40, height: 40, borderRadius: 999, backgroundColor: C.forestInk, justifyContent: 'center', alignItems: 'center' },
  actionButtonIcon: { fontSize: 16, color: C.cream },
  actionButtonRecording: { backgroundColor: C.errorText },

  // Thinking State
  thinkingContainer: { marginVertical: 6, alignItems: 'flex-start' },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.keylime,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderBottomLeftRadius: 2,
    gap: 8,
  },
  thinkingText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.forestInk,
  },

  // Error State
  errorContainer: { marginVertical: 6, alignItems: 'center' },
  errorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.errorBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    maxWidth: '90%',
  },
  errorIcon: { fontSize: 14 },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    color: C.errorText,
    flexShrink: 1,
  },

  // Compact NLP Understanding Card
  understandingCardWrap: { marginTop: 4, marginBottom: 8, maxWidth: '82%' },
  understandingCard: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.sage,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  understandingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  understandingTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.forestInk,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confidenceBadge: {
    backgroundColor: C.keylime,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.forestInk,
  },
  understandingDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  understandingTag: {
    fontSize: 12,
    fontWeight: '500',
    color: C.charcoal,
  },
  understandingTagBold: {
    fontSize: 13,
    fontWeight: '700',
    color: C.forestInk,
  },
  understandingBullet: {
    fontSize: 10,
    color: '#888888',
  },
  understandingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  understandingMetaText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666666',
  },

  // Confirmation Card (Confidence 0.60 - 0.84)
  confirmingCard: {
    backgroundColor: C.amberBg,
    borderWidth: 1,
    borderColor: C.amberBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  confirmingTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.amberText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confirmingBadge: {
    backgroundColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  confirmingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.amberText,
  },
  confirmingTag: {
    fontSize: 12,
    fontWeight: '500',
    color: '#78350F',
  },
  confirmingTagBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78350F',
  },
  confirmingMetaText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#92400E',
  },

  // Clarification Card (Confidence < 0.60)
  clarifyCard: {
    backgroundColor: C.infoBg,
    borderWidth: 1,
    borderColor: C.infoBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  clarifyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.infoText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clarifyBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  clarifyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.infoText,
  },
  clarifySubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E3A8A',
    lineHeight: 16,
  },
});

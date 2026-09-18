import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MEERA_FIXTURE, getFormattedTotal } from '../api/fixture';

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
};

const { chatMessages: MSGS, educationGoal: EDU } = MEERA_FIXTURE;

// ─── Initial message list ────────────────────────────────────────────────────
const INITIAL_MESSAGES = [
  {
    id: '1',
    sender: 'user',
    type: 'voice',
    duration: '0:04',
    text: MSGS[0].text,           // "I earned ₹800 from tailoring today"
    timestamp: MSGS[0].timestamp,
  },
  {
    id: '2',
    sender: 'saathi',
    type: 'text',
    text: `Got it! I've added ₹800 to your Business pot from tailoring. Aapka kul paisa ab ${getFormattedTotal()} hai — Your total across all pots is now ${getFormattedTotal()}.`,
    timestamp: MSGS[1].timestamp,
  },
  {
    id: '3',
    sender: 'user',
    type: 'text',
    text: MSGS[2].text,           // "Can I save enough for my daughter's education..."
    timestamp: MSGS[2].timestamp,
  },
  {
    id: '4',
    sender: 'saathi',
    type: 'text',
    text: `Aapko ₹12,000 aur chahiye. Agar aap har mahine ₹2,000 bachati hain, to 6 mahine mein lakshya poora hoga. — ${MSGS[3].text}`,
    timestamp: MSGS[3].timestamp,
  },
];

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      sender: 'user',
      type: 'text',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
  };

  const renderMessageItem = ({ item, index }) => {
    const isUser = item.sender === 'user';

    return (
      <View key={item.id}>
        {/* ── Chat bubble ─────────────────────────────────────────────── */}
        <View style={[styles.messageRow, isUser ? styles.userRow : styles.saathiRow]}>
          <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.saathiBubble]}>
            {!isUser && <Text style={styles.senderLabel}>Saathi</Text>}

            {item.type === 'voice' ? (
              <View style={styles.voiceContainer}>
                <View style={styles.voiceBadge}>
                  <Text style={styles.waveformIcon}>〰️🎙️</Text>
                  <Text style={styles.voiceDuration}>{item.duration}</Text>
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

        {/* ── After message id=2: Business Pot Confirmation Card ──────── */}
        {item.id === '2' && (
          <View style={styles.confirmCardWrap}>
            <View style={styles.confirmCard}>
              <View style={styles.confirmCardTop}>
                <View style={styles.confirmPill}>
                  <Text style={styles.confirmPillText}>✅ Business Pot</Text>
                </View>
                <Text style={styles.confirmAmount}>+₹800</Text>
              </View>
              <Text style={styles.confirmLine}>Tailoring kamai — Tailoring income added</Text>
              <View style={styles.confirmDivider} />
              <View style={styles.confirmTotalRow}>
                <Text style={styles.confirmTotalLabel}>Total abhi — Running total</Text>
                <Text style={styles.confirmTotalValue}>{getFormattedTotal()}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── After message id=2: Suspicious SMS Alert Card ───────────── */}
        {item.id === '2' && (
          <View style={styles.alertCardContainer}>
            <View style={styles.alertCard}>
              <View style={styles.alertCardHeader}>
                <Text style={styles.alertCardBadge}>⚠️ Suspicious SMS Detected</Text>
              </View>
              <View style={styles.alertCardBody}>
                <Text style={styles.alertCardLabel}>Flagged message:</Text>
                <Text style={styles.alertCardSms}>
                  "Your KYC will expire. Click here to verify: bit.ly/xyz123"
                </Text>
                <Text style={styles.alertCardDesc}>
                  Real banks do not ask for KYC verification via urgent SMS links.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.seeWhyButton}
                onPress={() => router.push('/safetyshield')}
                activeOpacity={0.8}
              >
                <Text style={styles.seeWhyButtonText}>🛡️ See why &amp; what to do</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── After message id=4: Education Goal Card ─────────────────── */}
        {item.id === '4' && (
          <View style={styles.eduCardWrap}>
            <View style={styles.eduCard}>
              {/* Header row */}
              <View style={styles.eduCardTop}>
                <View style={styles.eduBadge}>
                  <Text style={styles.eduBadgeText}>{EDU.hindiTitle}</Text>
                </View>
                <Text style={styles.eduPctText}>
                  {Math.round((EDU.savedAmount / EDU.targetAmount) * 100)}% done
                </Text>
              </View>

              <Text style={styles.eduTitle}>{EDU.title}</Text>
              <Text style={styles.eduSubtext}>{EDU.subtext}</Text>

              {/* Progress bar */}
              <View style={styles.eduProgressTrack}>
                <View
                  style={[
                    styles.eduProgressFill,
                    { width: `${Math.round((EDU.savedAmount / EDU.targetAmount) * 100)}%` },
                  ]}
                />
              </View>

              {/* Metrics */}
              <View style={styles.eduMetrics}>
                <View style={styles.eduMetricItem}>
                  <Text style={styles.eduMetricLabel}>Bachaya</Text>
                  <Text style={styles.eduMetricValue}>{EDU.savedText}</Text>
                </View>
                <View style={styles.eduMetricItem}>
                  <Text style={styles.eduMetricLabel}>Lakshya</Text>
                  <Text style={styles.eduMetricValue}>{EDU.targetText}</Text>
                </View>
              </View>

              {/* Action buttons */}
              <TouchableOpacity style={styles.eduPrimaryBtn} activeOpacity={0.8}>
                <Text style={styles.eduPrimaryBtnText}>
                  📅 Set {EDU.monthlyAmount} monthly reminder
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.eduSecondaryBtn} activeOpacity={0.7}>
                <Text style={styles.eduSecondaryBtnText}>📊 Check Education Pot</Text>
              </TouchableOpacity>
            </View>
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
          <Text style={styles.headerEyebrow}>SAATHI CHAT</Text>
          <Text style={styles.headerTitle}>Saathi Chat Assistant</Text>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Active</Text>
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
        />

        {/* ── BOTTOM INPUT BAR ─────────────────────────────────────────── */}
        <View style={[styles.inputBarContainer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Saathi se kuch bhi poochein — Ask Saathi anything..."
              placeholderTextColor="#666666"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
            />
            {inputText.trim().length > 0 ? (
              <TouchableOpacity style={styles.actionButton} onPress={handleSend} activeOpacity={0.8}>
                <Text style={styles.actionButtonIcon}>➔</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
                <Text style={styles.actionButtonIcon}>🎙️</Text>
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
});

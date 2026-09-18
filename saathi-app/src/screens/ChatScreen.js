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
import { SafeAreaView } from 'react-native-safe-area-context';

// --- STITCH DESIGN TOKENS ("Saathi Botanical") ---
const COLORS = {
  forestInk: '#0F3E17', // Primary brand, user bubble background, headings, CTAs
  cream: '#FFFEFC', // Main screen background, user bubble text
  keylimeWash: '#E1F4DF', // Saathi (AI) bubble background, input fill
  sageMist: '#B1DBB8', // Accent card/border surface
  slateHush: '#B6CED5', // Auxiliary accent
  charcoal: '#222222', // Saathi bubble text, subtext
  white: '#FFFFFF',
  inputBorder: '#D2E8D0',
};

// --- FIXTURE CONVERSATION ---
const INITIAL_MESSAGES = [
  {
    id: '1',
    sender: 'user',
    type: 'voice',
    duration: '0:04',
    text: 'I earned ₹800 from tailoring today',
    timestamp: '10:14 AM',
  },
  {
    id: '2',
    sender: 'saathi',
    type: 'text',
    text: "Got it! I've added ₹800 to your Business pot from tailoring. Your total across all pots is now ₹19,500.",
    timestamp: '10:14 AM',
  },
  {
    id: '3',
    sender: 'user',
    type: 'text',
    text: "Can I save enough for my daughter's education this year?",
    timestamp: '10:15 AM',
  },
  {
    id: '4',
    sender: 'saathi',
    type: 'text',
    text: "You need ₹12,000 more. If you save ₹2,000 every month, you'll reach your goal in 6 months.",
    timestamp: '10:15 AM',
  },
];

import { useRouter } from 'expo-router';

export default function ChatScreen() {
  const router = useRouter();
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

  const renderMessageItem = ({ item }) => {
    const isUser = item.sender === 'user';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userRow : styles.saathiRow,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.saathiBubble,
          ]}
        >
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
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.cream} />

      {/* 1. HEADER */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Saathi</Text>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.alertTriggerBadge}
            onPress={() => router.push('/safetyshield')}
            activeOpacity={0.7}
          >
            <Text style={styles.alertTriggerText}>⚠️ Safety Alert</Text>
          </TouchableOpacity>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Active</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* 2. MESSAGE LIST */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
        />

        {/* 4. BOTTOM INPUT BAR */}
        <View style={styles.inputBarContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="#666666"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
            />
            {inputText.trim().length > 0 ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleSend}
                activeOpacity={0.8}
              >
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  // 1. Header
  headerBar: {
    height: 56,
    backgroundColor: COLORS.cream,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.keylimeWash,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.forestInk,
    letterSpacing: 0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertTriggerBadge: {
    backgroundColor: COLORS.slateHush,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  alertTriggerText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.forestInk,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.keylimeWash,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    gap: 6,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: COLORS.forestInk,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.forestInk,
  },

  // 2. Message List & Bubbles
  listContentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  saathiRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  userBubble: {
    backgroundColor: COLORS.forestInk,
    borderBottomRightRadius: 2,
  },
  saathiBubble: {
    backgroundColor: COLORS.keylimeWash,
    borderBottomLeftRadius: 2,
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.forestInk,
    marginBottom: 2,
  },
  userBubbleText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.cream,
    lineHeight: 20,
  },
  saathiBubbleText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
    lineHeight: 20,
  },

  // Voice note styling
  voiceContainer: {
    gap: 6,
  },
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
    gap: 6,
  },
  waveformIcon: {
    fontSize: 12,
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.cream,
  },

  // Timestamps
  userTimestamp: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.cream,
    opacity: 0.7,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  saathiTimestamp: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.charcoal,
    opacity: 0.6,
    alignSelf: 'flex-end',
    marginTop: 2,
  },

  // 4. Bottom Input Bar
  inputBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.cream,
    borderTopWidth: 1,
    borderTopColor: COLORS.keylimeWash,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.keylimeWash,
    borderRadius: 999,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.charcoal,
    paddingVertical: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: COLORS.forestInk,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonIcon: {
    fontSize: 16,
    color: COLORS.cream,
  },
});

import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import ChatScreen from '../../screens/ChatScreen';

export default function TabTwoScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ChatScreen />
      <TouchableOpacity
        style={styles.testButton}
        onPress={() => router.push('/safetyshield')}
        activeOpacity={0.8}
      >
        <Text style={styles.testButtonText}>🛡️ Test Safety Shield</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  testButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: '#0F3E17',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  testButtonText: {
    color: '#FFFEFC',
    fontWeight: '600',
    fontSize: 12,
  },
});

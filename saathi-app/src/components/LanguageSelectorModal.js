import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { colors } from '../theme';

export default function LanguageSelectorModal({ visible, onClose }) {
  const { language, setLanguage, languages, t } = useLanguage();

  const handleSelect = async (code) => {
    await setLanguage(code);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('common.selectLanguage')}</Text>
            <Text style={styles.subtitle}>{t('common.chooseLanguage')}</Text>
          </View>

          <View style={styles.list}>
            {languages.map((item) => {
              const isSelected = item.code === language;
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[styles.langOption, isSelected && styles.langOptionSelected]}
                  onPress={() => handleSelect(item.code)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={item.label}
                >
                  <Text style={[styles.langLabel, isSelected && styles.langLabelSelected]}>
                    {item.label}
                  </Text>
                  {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text style={styles.closeButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 62, 23, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.paperCream,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.panelMint,
    shadowColor: colors.forestInk,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.forestInk,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedText,
  },
  list: {
    gap: 10,
    marginBottom: 18,
  },
  langOption: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  langOptionSelected: {
    backgroundColor: colors.panelKeylime,
    borderColor: colors.forestInk,
  },
  langLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  langLabelSelected: {
    color: colors.forestInk,
    fontWeight: '700',
  },
  checkIcon: {
    fontSize: 18,
    color: colors.forestInk,
    fontWeight: '700',
  },
  closeButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLow,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedText,
  },
});

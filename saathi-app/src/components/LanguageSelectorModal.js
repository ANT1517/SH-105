import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { colors, radius, shadows, typography } from '../theme';

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
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Ionicons name="checkmark" size={13} color={colors.cream} />
                    </View>
                  )}
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
    backgroundColor: 'rgba(15, 62, 23, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.cream,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.modal,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    ...typography.headlineMd,
    color: colors.forestInk,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.mutedText,
  },
  list: {
    gap: 8,
    marginBottom: 18,
  },
  langOption: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.button,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  langOptionSelected: {
    backgroundColor: colors.panelKeylime,
    borderColor: colors.forestInk,
  },
  langLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.charcoal,
  },
  langLabelSelected: {
    color: colors.forestInk,
    fontWeight: '700',
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.forestInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.button,
    backgroundColor: colors.panelKeylime,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.forestInk,
  },
});

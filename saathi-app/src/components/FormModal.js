import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, radius, shadows, typography } from '../theme';

/**
 * Small bottom-sheet form. fields: [{ key, label, keyboardType?, placeholder? }]; onSubmit(values) may throw,
 * in which case its message is shown and the sheet stays open.
 */
export default function FormModal({ visible, title, fields, initialValues, submitLabel, onSubmit, onClose }) {
  const { t } = useTranslation();
  const resolvedSubmitLabel = submitLabel || t('common.save');
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (visible) setValues(initialValues || {}); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { setValues({}); setError(''); onClose(); };
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onSubmit(values);
      setValues({});
      onClose();
    } catch (e) {
      setError(e && e.message ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handleBar} />
          <Text style={styles.title}>{title}</Text>
          {fields.map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                value={values[f.key] || ''}
                onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                keyboardType={f.keyboardType || 'default'}
                placeholder={f.placeholder}
                placeholderTextColor="#7D8880"
              />
            </View>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={close} disabled={busy} activeOpacity={0.7}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.save]} onPress={submit} disabled={busy} activeOpacity={0.8}>
              <Text style={styles.saveText}>{busy ? t('common.saving') : resolvedSubmitLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 62, 23, 0.45)' },
  sheet: {
    backgroundColor: colors.cream,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...shadows.modal,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderMist,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { ...typography.headlineMd, color: colors.forestInk, marginBottom: 14 },
  field: { marginBottom: 12 },
  label: { ...typography.labelMd, color: colors.charcoal, marginBottom: 6 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.charcoal,
  },
  error: { color: colors.errorText, fontSize: 12, fontWeight: '500', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: radius.button, alignItems: 'center' },
  cancel: {
    backgroundColor: colors.panelKeylime,
    borderWidth: 1,
    borderColor: colors.keylimeBorder,
  },
  cancelText: { color: colors.forestInk, fontWeight: '700', fontSize: 14 },
  save: { backgroundColor: colors.forestInk },
  saveText: { color: colors.cream, fontWeight: '700', fontSize: 14 },
});

import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';

/**
 * Small bottom-sheet form. fields: [{ key, label, keyboardType?, placeholder? }]; onSubmit(values) may throw,
 * in which case its message is shown and the sheet stays open.
 */
export default function FormModal({ visible, title, fields, initialValues, submitLabel = 'Save', onSubmit, onClose }) {
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
                placeholderTextColor="#9AA59B"
              />
            </View>
          ))}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={close} disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.save]} onPress={submit} disabled={busy}>
              <Text style={styles.saveText}>{busy ? 'Saving...' : submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#FFFEFC', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#0F3E17', marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: '#222222', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#B1DBB8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#222222' },
  error: { color: '#B00020', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancel: { backgroundColor: '#E1F4DF' },
  cancelText: { color: '#0F3E17', fontWeight: '600' },
  save: { backgroundColor: '#0F3E17' },
  saveText: { color: '#FFFFFF', fontWeight: '600' },
});

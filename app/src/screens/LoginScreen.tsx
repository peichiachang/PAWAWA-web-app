import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { styles, palette } from '../styles/common';

interface Props {
  onGoToRegister: () => void;
}

export function LoginScreen({ onGoToRegister }: Props) {
  const { login, error, clearError } = useAuth();
  const [accountType, setAccountType] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const creds = accountType === 'email'
      ? { email: email.trim(), password }
      : { phone: phone.trim(), password };
    if (accountType === 'email' && !creds.email) {
      Alert.alert('請輸入 Email');
      return;
    }
    if (accountType === 'phone' && !creds.phone) {
      Alert.alert('請輸入手機號碼');
      return;
    }
    if (!password) {
      Alert.alert('請輸入密碼');
      return;
    }
    setSubmitting(true);
    clearError();
    try {
      await login(creds);
    } catch (_e) {
      // error already set in context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48 }} keyboardShouldPersistTaps="handled">
      <Text style={[styles.appTitle, { marginBottom: 8 }]}>登入</Text>
      <Text style={{ fontSize: 13, color: palette.muted, marginBottom: 24 }}>使用 Email 或手機號碼登入</Text>

      <View style={[styles.choiceRow, { marginBottom: 16 }]}>
        <Pressable
          style={[styles.choiceBtn, accountType === 'email' && styles.choiceBtnActive]}
          onPress={() => { setAccountType('email'); clearError(); }}
        >
          <Text style={[styles.choiceBtnText, accountType === 'email' && styles.choiceBtnTextActive]}>Email</Text>
        </Pressable>
        <Pressable
          style={[styles.choiceBtn, accountType === 'phone' && styles.choiceBtnActive]}
          onPress={() => { setAccountType('phone'); clearError(); }}
        >
          <Text style={[styles.choiceBtnText, accountType === 'phone' && styles.choiceBtnTextActive]}>手機號碼</Text>
        </Pressable>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>{accountType === 'email' ? 'Email' : '手機號碼'}</Text>
        {accountType === 'email' ? (
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : (
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="09xxxxxxxx"
            keyboardType="phone-pad"
          />
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>密碼</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="至少 6 個字元"
          secureTextEntry
        />
      </View>

      {error ? (
        <View style={[styles.messageBoxDanger, { marginBottom: 16 }]}>
          <Text style={styles.messageBoxDangerText}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.primaryBtnText}>{submitting ? '登入中…' : '登入'}</Text>
      </Pressable>

      <Pressable onPress={onGoToRegister} style={{ marginTop: 24, alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: palette.primary, fontWeight: '600' }}>還沒有帳號？立即註冊</Text>
      </Pressable>
    </ScrollView>
  );
}

import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { styles, palette } from '../styles/common';

interface Props {
  onGoToLogin: () => void;
}

export function RegisterScreen({ onGoToLogin }: Props) {
  const { register, error, clearError } = useAuth();
  const [accountType, setAccountType] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (accountType === 'email' && !email.trim()) {
      Alert.alert('請輸入 Email');
      return;
    }
    if (accountType === 'phone' && !phone.trim()) {
      Alert.alert('請輸入手機號碼');
      return;
    }
    if (password.length < 6) {
      Alert.alert('密碼至少 6 個字元');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('兩次密碼輸入不一致');
      return;
    }
    const creds = accountType === 'email'
      ? { email: email.trim(), password }
      : { phone: phone.trim(), password };
    setSubmitting(true);
    clearError();
    try {
      await register(creds);
    } catch (_e) {
      // error in context
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48 }} keyboardShouldPersistTaps="handled">
      <Text style={[styles.appTitle, { marginBottom: 8 }]}>註冊</Text>
      <Text style={{ fontSize: 13, color: palette.muted, marginBottom: 24 }}>以 Email 或手機號碼建立帳號（UUID 將自動產生）</Text>

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

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>再次輸入密碼</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="請再輸入一次密碼"
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
        <Text style={styles.primaryBtnText}>{submitting ? '註冊中…' : '註冊'}</Text>
      </Pressable>

      <Pressable onPress={onGoToLogin} style={{ marginTop: 24, alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: palette.primary, fontWeight: '600' }}>已有帳號？前往登入</Text>
      </Pressable>
    </ScrollView>
  );
}

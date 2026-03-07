import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, View } from 'react-native';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';
import { useAuth } from '../contexts/AuthContext';
import { styles } from '../styles/common';

/**
 * 未登入時顯示：登入 / 註冊二選一
 */
export function AuthGateScreen() {
  const { loading } = useAuth();
  const [screen, setScreen] = useState<'login' | 'register'>('login');

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {screen === 'login' ? (
        <LoginScreen onGoToRegister={() => setScreen('register')} />
      ) : (
        <RegisterScreen onGoToLogin={() => setScreen('login')} />
      )}
    </SafeAreaView>
  );
}

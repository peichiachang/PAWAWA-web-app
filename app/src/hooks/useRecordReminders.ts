import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECORD_REMINDERS_KEY = 'carecat:record_reminders:ids';
const CHANNEL_ID = 'record-reminders';
const MORNING_HOUR = 8;
const MORNING_MINUTE = 0;
const EVENING_HOUR = 18;
const EVENING_MINUTE = 0;

const MORNING_ID = 'carecat_reminder_morning';
const EVENING_ID = 'carecat_reminder_evening';

if (Platform.OS !== 'web') {
  // 前景時也顯示通知
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(RECORD_REMINDERS_KEY);
}

async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '照護紀錄提醒',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
}

async function scheduleReminders(): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  await setupAndroidChannel();
  await cancelAllScheduled();

  const ids: string[] = [];

  await Notifications.scheduleNotificationAsync({
    identifier: MORNING_ID,
    content: {
      title: 'Carecat 提醒',
      body: '記得記錄上午的飲食與飲水喔～',
      data: { type: 'record_reminder', period: 'morning' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: MORNING_HOUR,
      minute: MORNING_MINUTE,
      channelId: CHANNEL_ID,
    },
  });
  ids.push(MORNING_ID);

  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_ID,
    content: {
      title: 'Carecat 提醒',
      body: '記得記錄傍晚的飲食與飲水喔～',
      data: { type: 'record_reminder', period: 'evening' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: EVENING_HOUR,
      minute: EVENING_MINUTE,
      channelId: CHANNEL_ID,
    },
  });
  ids.push(EVENING_ID);

  await AsyncStorage.setItem(RECORD_REMINDERS_KEY, JSON.stringify(ids));
}

export function useRecordReminders() {
  useEffect(() => {
    async function init() {
      try {
        await scheduleReminders();
      } catch (e) {
        console.warn('[RecordReminders] Failed to schedule:', e);
      }
    }
    init();
  }, []);

  const reschedule = useCallback(async () => {
    try {
      await scheduleReminders();
    } catch (e) {
      console.warn('[RecordReminders] Failed to reschedule:', e);
    }
  }, []);

  return { reschedule };
}

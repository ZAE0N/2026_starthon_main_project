import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, space, radius, font, weight, screenPadding, minTouch } from '../constants/theme';
import { copy } from '../constants/copy';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* 헤더 / 타이틀 영역 */}
        <View style={styles.header}>
          <Text style={styles.badge}>알바 권익 진단 툴</Text>
          <Text style={styles.title}>내 근로계약서,{'\n'}문제없을까요?</Text>
          <Text style={styles.subtitle}>
            사진 한 장만 찍으면 AI가 위법 조항을 찾아 진단해 드려요.
          </Text>
        </View>

        {/* 통계 지표 영역 (민트 세로선 + 큰 숫자 시안 반영) */}
        <View style={styles.statCard}>
          <View style={styles.statLine} />
          <View style={styles.statContent}>
            <View style={styles.statNumberRow}>
              <Text style={styles.statNumber}>89</Text>
              <Text style={styles.statPercent}>%</Text>
            </View>
            <Text style={styles.statLabel}>
              청소년·청년 알바생 근로계약서 중{'\n'}독소 조항 또는 독소 내용 포함 비율
            </Text>
          </View>
        </View>

        {/* 메인 버튼 및 보조 버튼 영역 */}
        <View style={styles.actionContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/camera')}
          >
            <Text style={styles.primaryButtonText}>계약서 촬영하기</Text>
          </Pressable>

          <View style={styles.secondaryButtonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={() => router.push('/history')}
            >
              <Text style={styles.secondaryButtonText}>내 기록</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
              onPress={() => router.push('/help')}
            >
              <Text style={styles.secondaryButtonText}>도움받기</Text>
            </Pressable>
          </View>

          {/* 개인정보 및 면책 문구 (copy.privacyShort 필수 바인딩) */}
          <Text style={styles.privacyNote}>{copy.privacyShort}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingHorizontal: screenPadding,
    paddingTop: space.xl,
    paddingBottom: space.xl,
    justifyContent: 'space-between',
    minHeight: '100%',
  },
  header: {
    marginBottom: space.lg,
  },
  badge: {
    fontSize: font.small,
    color: colors.mintText,
    fontWeight: weight.semibold,
    marginBottom: space.xs,
  },
  title: {
    fontSize: font.h1,
    fontWeight: weight.bold,
    color: colors.navy,
    lineHeight: 34,
    marginBottom: space.sm,
  },
  subtitle: {
    fontSize: font.body,
    color: colors.navySoft,
    lineHeight: 22,
  },
  statCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginVertical: space.md,
  },
  statLine: {
    width: 4,
    height: '100%',
    backgroundColor: colors.mint,
    borderRadius: radius.full,
    marginRight: space.md,
  },
  statContent: {
    flex: 1,
  },
  statNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: weight.bold,
    color: colors.navy,
  },
  statPercent: {
    fontSize: font.h2,
    fontWeight: weight.bold,
    color: colors.navy,
    marginLeft: 2,
  },
  statLabel: {
    fontSize: font.small,
    color: colors.gray,
    marginTop: space.xs,
    lineHeight: 18,
  },
  actionContainer: {
    marginTop: space.lg,
    gap: space.sm,
  },
  primaryButton: {
    backgroundColor: colors.navy,
    paddingVertical: space.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: minTouch,
  },
  buttonPressed: {
    backgroundColor: colors.navyPressed,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: weight.bold,
  },
  secondaryButtonRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: minTouch,
  },
  secondaryButtonPressed: {
    backgroundColor: colors.line,
  },
  secondaryButtonText: {
    color: colors.navy,
    fontSize: font.body,
    fontWeight: weight.medium,
  },
  privacyNote: {
    fontSize: font.tiny,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: space.sm,
  },
});
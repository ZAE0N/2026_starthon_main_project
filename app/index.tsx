import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, space, radius, font, weight, screenPadding, minTouch } from '../constants/theme';
import { copy } from '../constants/copy';
import { CHECK_LABELS, CHECK_ORDER } from '../types';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* 헤더 / 타이틀 영역 */}
        <View style={styles.header}>
          <Text style={styles.badge}>CheckUp</Text>
          <Text style={styles.title}>내 근로계약서,{'\n'}문제없을까요?</Text>
          <Text style={styles.subtitle}>
            사진 한 장만 찍으면 문제가 될 수 있는 조항을 찾아드려요.
          </Text>
        </View>

        {/*
          카드 두 장. 예전에는 "89%" 하나만 있었는데 그 숫자의 출처를 대지 못해
          빼고, 우리가 실제로 가진 사실로 채웠습니다. (PROGRESS.md 의 R6)

          항목 개수는 CHECK_ORDER 에서 세서 씁니다. 숫자를 적어두면 항목이 늘거나
          줄었을 때 이 화면이 거짓이 됩니다. analyzing.tsx 도 같은 이유로 그렇게 했습니다.
        */}
        <View style={styles.cards}>
          <View style={styles.infoCard}>
            <View style={styles.infoLine} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>
                {CHECK_ORDER.length}가지를 확인해요
              </Text>
              <Text style={styles.infoBody}>
                {CHECK_ORDER.map((id) => CHECK_LABELS[id]).join(' · ')}
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoLine} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>말 꺼낼 문장까지 알려줘요</Text>
              <Text style={styles.infoBody}>
                문제를 찾는 데서 끝나지 않아요. 사장님께 어떻게 말하면 되는지
                두 가지 말투로 준비해 드려요.
              </Text>
            </View>
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
    // 문구가 화면 위에 붙어 보인다는 지적이 있어 한 칸 내렸습니다.
    marginTop: space.xl,
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
  cards: { gap: space.sm, marginVertical: space.md },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: space.md,
    borderRadius: radius.md,
  },
  infoLine: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.mint,
    borderRadius: radius.full,
    marginRight: space.md,
  },
  infoContent: { flex: 1 },
  infoTitle: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.navy,
  },
  infoBody: {
    marginTop: space.xs,
    fontSize: font.small,
    color: colors.gray,
    lineHeight: 19,
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
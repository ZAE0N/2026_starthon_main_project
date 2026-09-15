import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, space, radius, font, weight, screenPadding, minTouch } from '../constants/theme';
import { copy } from '../constants/copy';
import RotatingCards, { type InfoCard } from '../components/RotatingCards';
import { CHECK_LABELS, CHECK_ORDER } from '../types';

/*
  안내 카드. 4.2초마다 한 장씩 바뀝니다. (components/RotatingCards.tsx)

  예전에는 두 장을 세로로 쌓아 뒀는데 화면이 길어지고 둘 다 대충 읽혔습니다.
  한 장씩 크게 보여주는 쪽으로 바꿨고, 화면이 비어 보여서 "몰랐을 수도 있는
  사실" 카드를 늘렸습니다.

  ⚠ law 는 반드시 server/laws.json 의 값과 같아야 합니다. 숫자와 조문을 여기서
    새로 만들지 마세요. 틀린 조문을 보여주면 판정 전체가 의심받습니다.
    "89%" 카드를 뺀 것도 출처를 대지 못해서였습니다 (PROGRESS.md 의 R6).

  항목 개수는 CHECK_ORDER 에서 세서 씁니다. 숫자를 적어두면 항목이 늘거나
  줄었을 때 이 화면이 거짓이 됩니다. analyzing.tsx 도 같은 이유로 그렇게 했습니다.
*/
const INFO_CARDS: InfoCard[] = [
  {
    title: `${CHECK_ORDER.length}가지를 확인해요`,
    body: CHECK_ORDER.map((id) => CHECK_LABELS[id]).join(' · '),
  },
  /*
    판정 전제를 처음부터 알려줍니다.

    회의 결론입니다. 전에는 결과 화면 아래에만 있었는데, 그건 이미 판정을
    다 본 뒤입니다. 5명 미만인 곳에서 일하는 사람은 자기 결과가 기준에
    안 맞는다는 걸 마지막에 알게 됩니다.

    문구는 laws.json 의 assumptions 와 같은 기준입니다.
    서버가 조건을 받아 판정하게 되면(FEATURE_hidden-conditions) 이 카드는
    촬영 화면의 질문으로 대체될 수 있습니다.
  */
  {
    title: '먼저 알아두세요',
    body:
      '기본은 만 18세 이상, 일하는 사람이 5명 이상인 곳 기준이에요. ' +
      '촬영 화면에서 알려주시면 그 기준으로 다시 봐요.',
  },
  /*
    아래 네 장은 "몰랐을 수도 있는 사실" 입니다.

    고른 기준: 아르바이트가 가장 자주 손해 보면서도 모르는 것, 그리고 계약서에
    어떻게 적혀 있든 결과가 바뀌지 않는 것입니다. 그래서 "계약서를 봐야 안다" 가
    아니라 지금 바로 알려줄 수 있습니다.
  */
  {
    title: '주휴수당, 알바도 받아요',
    body:
      '주 15시간 이상 일하고 정한 날에 다 나왔다면 하루치 임금을 더 받아요. ' +
      '계약서에 안 적혀 있어도 받을 수 있어요.',
    law: '근로기준법 제55조',
  },
  {
    title: '그만둔다고 위약금을 물릴 수 없어요',
    body:
      '"중간에 그만두면 얼마를 배상한다" 같은 조항은 계약서에 넣을 수 없어요. ' +
      '적혀 있어도 효력이 없어요.',
    law: '근로기준법 제20조',
  },
  {
    title: '수습이라고 무조건 깎을 수 없어요',
    body:
      '1년 미만 계약이거나 주방보조·청소 같은 단순노무면 수습이어도 ' +
      '최저임금을 그대로 받아야 해요.',
    law: '최저임금법 제5조 제2항',
  },
  {
    title: '4시간 일하면 30분은 쉬어요',
    body:
      '8시간이면 1시간이에요. 일하는 중간에 줘야 하고, ' +
      '손님 없을 때 앉아 있으라는 건 휴게시간이 아니에요.',
    law: '근로기준법 제54조',
  },
];

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

        <RotatingCards cards={INFO_CARDS} />

        {/* 메인 버튼 및 보조 버튼 영역 */}
        <View style={styles.actionContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            /* 촬영 전에 조건을 먼저 묻습니다. 거기서 /camera 로 넘어갑니다 */
            onPress={() => router.push('/ask')}
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
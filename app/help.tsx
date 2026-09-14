import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, SafeAreaView, Linking } from 'react-native';

import { colors, space, radius, font, weight, screenPadding, minTouch } from '../constants/theme';
import { copy } from '../constants/copy';

export default function HelpScreen() {

  const handlePressCall = (tel: string) => {
    // 공백 및 특수문자 제거 후 전화 걸기 연결
    const cleanedTel = tel.replace(/[^0-9]/g, '');
    Linking.openURL(`tel:${cleanedTel}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* 상단 헤더 영역 */}
        <View style={styles.header}>
          
          <Text style={styles.subtitle}>
            혼자 해결하기 어려운 근로권익 침해 문제,{'\n'}전문 무료 상담센터에서 도움을 받을 수 있어요.
          </Text>
        </View>

        {/* copy.help 데이터 배열을 map으로 돌려 카드 생성 */}
        <View style={styles.cardList}>
          {copy.help.map((item, index) => (
            <View key={index} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.centerName}>{item.name}</Text>
                <Text style={styles.centerDesc}>{item.desc}</Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.callButton,
                  pressed && styles.callButtonPressed,
                ]}
                onPress={() => handlePressCall(item.tel)}
              >
                {/* 대비 통과를 위해 colors.mintText 사용 */}
                <Text style={styles.callButtonText}>전화 상담 ({item.tel})</Text>
              </Pressable>
            </View>
          ))}
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
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  header: {
    marginBottom: space.lg,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: space.xs,
    paddingRight: space.sm,
    marginBottom: space.sm,
    minHeight: minTouch,
    justifyContent: 'center',
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  backButtonText: {
    fontSize: font.body,
    color: colors.navySoft,
    fontWeight: weight.medium,
  },
  title: {
    fontSize: font.h1,
    fontWeight: weight.bold,
    color: colors.navy,
    marginBottom: space.xs,
  },
  subtitle: {
    fontSize: font.body,
    color: colors.gray,
    lineHeight: 22,
  },
  cardList: {
    gap: space.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  cardHeader: {
    marginBottom: space.md,
  },
  centerName: {
    fontSize: font.h2,
    fontWeight: weight.bold,
    color: colors.navy,
    marginBottom: space.xs,
  },
  centerDesc: {
    fontSize: font.small,
    color: colors.gray,
    lineHeight: 18,
  },
  callButton: {
    backgroundColor: colors.white,
    borderColor: colors.mint,
    borderWidth: 1.5,
    paddingVertical: space.sm + 2,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: minTouch,
  },
  callButtonPressed: {
    backgroundColor: colors.mintBg,
  },
  callButtonText: {
    fontSize: font.body,
    fontWeight: weight.bold,
    color: colors.mintText, // 흰 배경 대비율 기준 충족
  },

});
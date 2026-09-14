/**
 * 사진 선택 화면. 담당: 나영웅
 *
 * 화면이 두 겹입니다.
 *   1) 안내 화면 — 초록 네모 삽화와 팁. 실제 촬영 화면이 아닙니다
 *   2) 앱 안 카메라 — "사진 찍기" 를 누르면 전체 화면으로 열립니다.
 *      expo-camera 의 미리보기 위에 초록 가이드 네모를 겹칩니다. 시안 2번입니다
 *
 * 앱 안 카메라가 안 되면(권한 거부·기기 문제·웹) 폰 기본 카메라로 되돌아갑니다.
 * 촬영은 모든 흐름의 입구라서, 막히면 앱 전체가 멈춥니다. 그래서 되돌아갈 길을
 * 남겨뒀습니다. lib/photo.ts 의 takePhoto() 가 그 경로입니다.
 *
 * 갤러리 버튼은 빼지 마세요. 이미 계약서를 쓰고 사진만 남은 사용자가 주 타깃이고,
 * 매장에서 셔터음 때문에 못 찍는 경우도 있습니다.
 */

import { useRef, useState } from "react";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Camera as CameraIcon, X } from "lucide-react-native";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { photoFromShot, pickPhoto, takePhoto } from "../lib/photo";
import { clearCurrent, setCurrentPhoto } from "../lib/session";
import { copy } from "../constants/copy";
import {
  colors,
  font,
  minTouch,
  radius,
  screenPadding,
  space,
  weight,
} from "../constants/theme";

type Source = "camera" | "library";

/** 시안 2번의 "글자가 잘리지 않게 전체가 보이도록" 을 실제로 지킬 수 있게 풀어 썼습니다. */
const TIPS = [
  "초록 네모처럼 네 귀퉁이가 모두 보이게 맞춰주세요",
  "밝은 곳에서, 그림자가 지지 않게 찍어주세요",
  "뒷장이 있으면 따로 한 번 더 확인해 주세요",
];

export default function Camera() {
  /** 어떤 버튼이 진행 중인지. null 이면 대기 상태입니다. */
  const [busy, setBusy] = useState<Source | null>(null);
  /** 권한이 거부된 경로. 안내를 띄울 때만 값이 들어갑니다. */
  const [denied, setDenied] = useState<Source | null>(null);

  /** 앱 안 카메라가 열려 있는지 */
  const [shooting, setShooting] = useState(false);
  const camRef = useRef<CameraView>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();

  /**
   * "사진 찍기" — 앱 안 카메라를 엽니다.
   *
   * 권한이 없으면 한 번 요청하고, 거부되면 폰 기본 카메라로 넘깁니다.
   * 기본 카메라도 거부되면 그때 안내를 띄웁니다. 초록 네모를 못 보여주는 것보다
   * 사진을 아예 못 찍는 게 훨씬 나쁩니다.
   */
  async function openCamera() {
    if (busy) return;

    const ok = camPerm?.granted ? true : (await requestCamPerm())?.granted;
    if (!ok) {
      await choose("camera"); // 폰 기본 카메라로 되돌아갑니다
      return;
    }

    setDenied(null);
    setShooting(true);
  }

  /** 셔터. 찍은 사진을 기존 파이프라인(축소·base64)에 태웁니다. */
  async function shoot() {
    if (busy) return;
    setBusy("camera");

    try {
      const shot = await camRef.current?.takePictureAsync({
        quality: 1,
        // base64 는 여기서 받지 않습니다. 축소한 다음에 만들어야 용량이 줄어듭니다.
        base64: false,
        exif: false,
      });

      const photo = shot ? await photoFromShot(shot) : null;
      if (!photo) {
        setBusy(null);
        return;
      }

      setShooting(false);
      clearCurrent();
      setCurrentPhoto(photo);
      router.replace("/analyzing");
      // busy 는 일부러 되돌리지 않습니다. 아래 choose() 와 같은 이유입니다.
    } catch {
      // 촬영 실패. 카메라를 닫고 폰 기본 카메라로 넘깁니다.
      setShooting(false);
      setBusy(null);
      await choose("camera");
    }
  }

  async function choose(source: Source) {
    if (busy) return; // 연타 방지. 사진이 올 때까지 두 번째 터치를 무시합니다.
    setBusy(source);
    setDenied(null);

    try {
      const photo = source === "camera" ? await takePhoto() : await pickPhoto();

      if (!photo) {
        // null 은 "취소" 와 "권한 거부" 두 가지입니다. lib/photo.ts 가 이유를
        // 돌려주지 않아서, 권한 상태를 직접 한 번 더 읽어 구분합니다.
        // (취소한 사람에게 권한 안내를 띄우면 더 헷갈립니다.)
        if (!(await hasPermission(source))) setDenied(source);
        setBusy(null);
        return;
      }

      clearCurrent(); // 이전 결과·사진 비우기
      setCurrentPhoto(photo);
      router.replace("/analyzing");
      // busy 는 일부러 되돌리지 않습니다. 화면이 넘어가는 동안 버튼이 다시
      // 눌리면 분석이 두 번 돌고 API 비용이 두 배가 됩니다.
    } catch {
      setBusy(null);
    }
  }

  const permission = copy.errors.permission;

  return (
    <>
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.guide}>
        <Text style={styles.title}>계약서 전체가 보이게 찍어주세요</Text>
        <Text style={styles.sub}>
          아래 초록 네모처럼 계약서 한 장이 화면에 다 들어오면 돼요.
        </Text>

        {/* 촬영 예시 그림 — 실제 카메라 화면이 아닙니다 */}
        <View style={styles.artWrap} accessible={false}>
          <View style={styles.paper}>
            <View style={[styles.skeleton, styles.skeletonTitle]} />
            <View style={[styles.skeleton, styles.skeletonFull]} />
            <View style={[styles.skeleton, styles.skeletonFull]} />
            <View style={[styles.skeleton, styles.skeletonShort]} />
            <View style={[styles.skeleton, styles.skeletonFull]} />
            <View style={[styles.skeleton, styles.skeletonMid]} />

            {/* 네 귀퉁이 표시 */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>

        <View style={styles.tips}>
          {TIPS.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.foot}>
        {denied !== null && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{permission.title}</Text>
            <Text style={styles.noticeBody}>{permission.body}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.noticeButton,
                pressed && styles.noticeButtonPressed,
              ]}
              onPress={() => {
                void Linking.openSettings();
              }}
              accessibilityRole="button"
              accessibilityLabel={permission.action}
            >
              <Text style={styles.noticeButtonText}>{permission.action}</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.primary,
            pressed && styles.primaryPressed,
            busy !== null && styles.dim,
          ]}
          disabled={busy !== null}
          onPress={openCamera}
          accessibilityRole="button"
          accessibilityLabel="사진 찍기"
          accessibilityState={{ disabled: busy !== null, busy: busy === "camera" }}
        >
          {busy === "camera" ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryText}>사진 찍기</Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondary,
            pressed && styles.secondaryPressed,
            busy !== null && styles.dim,
          ]}
          disabled={busy !== null}
          onPress={() => choose("library")}
          accessibilityRole="button"
          accessibilityLabel="갤러리에서 고르기"
          accessibilityState={{
            disabled: busy !== null,
            busy: busy === "library",
          }}
        >
          {busy === "library" ? (
            <ActivityIndicator color={colors.navy} />
          ) : (
            <Text style={styles.secondaryText}>갤러리에서 고르기</Text>
          )}
        </Pressable>

        <Text style={styles.footNote}>
          이미 찍어둔 계약서 사진이 있다면 갤러리에서 골라도 돼요.
        </Text>
      </View>
    </ScrollView>

    {/*
      앱 안 카메라. expo-camera 미리보기 위에 초록 가이드 네모를 겹칩니다.
      시안 2번입니다.

      네모는 A4 비율(0.707)로 두었습니다. 계약서가 대개 A4 라서, 이 안에
      맞추면 잘리지 않습니다. 네모 밖은 어둡게 덮어 어디에 맞춰야 하는지
      눈에 바로 들어오게 했습니다.
    */}
    <Modal
      visible={shooting}
      animationType="slide"
      onRequestClose={() => setShooting(false)}
      statusBarTranslucent
    >
      <View style={styles.camScreen}>
        <CameraView ref={camRef} style={styles.camView} facing="back" />

        {/* 미리보기 위에 겹치는 것들. 터치는 통과시킵니다 */}
        <View style={styles.camOverlay} pointerEvents="none">
          <Text style={styles.camHint}>
            초록 네모 안에 계약서 전체가 들어오게 맞춰주세요
          </Text>

          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>

          <Text style={styles.camHintSub}>
            밝은 곳에서, 그림자가 지지 않게
          </Text>
        </View>

        {/* 조작부 */}
        <View style={styles.camFoot}>
          <Pressable
            style={styles.camClose}
            onPress={() => setShooting(false)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <X size={24} color={colors.white} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.shutter,
              pressed && styles.shutterPressed,
              busy !== null && styles.dim,
            ]}
            disabled={busy !== null}
            onPress={shoot}
            accessibilityRole="button"
            accessibilityLabel="사진 찍기"
            accessibilityState={{ disabled: busy !== null, busy: busy !== null }}
          >
            {busy !== null ? (
              <ActivityIndicator color={colors.navy} />
            ) : (
              <CameraIcon size={26} color={colors.navy} />
            )}
          </Pressable>

          {/* 셔터를 가운데 두려고 반대쪽에 같은 크기를 비워둡니다 */}
          <View style={styles.camClose} />
        </View>
      </View>
    </Modal>
    </>
  );
}

/**
 * 권한이 켜져 있는지만 확인합니다. (새로 요청하지 않습니다)
 *
 * lib/photo.ts 는 "취소" 와 "권한 거부" 를 모두 null 로 돌려줍니다.
 * 화면에서 둘을 구분해야 안내를 제대로 띄울 수 있어서 상태만 읽습니다.
 * 사진을 가져오는 일은 그대로 lib/photo.ts 가 합니다.
 *
 * TODO(전정현): lib/photo.ts 가 거부 이유를 함께 돌려주면 이 함수는 지워도 됩니다.
 */
async function hasPermission(source: Source): Promise<boolean> {
  try {
    const perm =
      source === "camera"
        ? await ImagePicker.getCameraPermissionsAsync()
        : await ImagePicker.getMediaLibraryPermissionsAsync();
    return perm.granted;
  } catch {
    // 상태를 못 읽으면 "취소" 로 봅니다. 권한 안내를 잘못 띄우는 쪽이 더 나쁩니다.
    return true;
  }
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    padding: screenPadding,
    justifyContent: "space-between",
    backgroundColor: colors.bg,
  },

  guide: { flex: 1, justifyContent: "center", paddingVertical: space.lg },
  title: { fontSize: font.h2, fontWeight: weight.bold, color: colors.navy },
  sub: {
    marginTop: space.sm,
    fontSize: font.body,
    color: colors.navySoft,
    lineHeight: 24,
  },

  /* 촬영 예시 그림 */
  artWrap: { alignItems: "center", marginTop: space.lg },
  paper: {
    width: "68%",
    aspectRatio: 0.74,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    // 초록 점선. 귀퉁이 표시만으로는 "여기에 맞춰라" 가 덜 읽힙니다
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.green,
    padding: space.md,
    justifyContent: "center",
    gap: space.sm,
  },
  skeleton: { height: 6, borderRadius: radius.sm, backgroundColor: colors.line },
  skeletonTitle: {
    height: 10,
    width: "52%",
    marginBottom: space.xs,
    backgroundColor: colors.grayLight,
  },
  skeletonFull: { width: "100%" },
  skeletonMid: { width: "78%" },
  skeletonShort: { width: "45%" },

  /* ── 앱 안 카메라 ────────────────────────────────────────── */
  camScreen: { flex: 1, backgroundColor: "#000" },
  camView: { flex: 1 },

  /*
   * 미리보기 위에 겹치는 층. 터치는 통과시켜야 합니다.
   * pointerEvents="none" 을 안 주면 셔터가 안 눌립니다.
   */
  camOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: space.lg,
    paddingHorizontal: space.lg,
  },
  camHint: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: weight.semibold,
    textAlign: "center",
  },
  camHintSub: {
    color: colors.grayLight,
    fontSize: font.small,
    textAlign: "center",
  },

  /*
   * 가이드 네모. A4 비율(0.707)로 두었습니다. 계약서가 대개 A4 라서
   * 이 안에 맞추면 잘리지 않습니다.
   */
  frame: {
    width: "100%",
    aspectRatio: 0.707,
    maxHeight: "70%",
    borderWidth: 2,
    borderColor: colors.green,
    borderRadius: radius.sm,
  },

  camFoot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: screenPadding,
    paddingTop: space.md,
    paddingBottom: space.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  camClose: {
    width: minTouch,
    height: minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.green,
  },
  shutterPressed: { backgroundColor: colors.surface },

  /*
   * 가이드 프레임의 네 귀퉁이.
   *
   * 초록으로 바꾸고 크기를 키웠습니다. "가이드 라인이 없어서 어떻게 찍어야
   * 할지 모르겠다" 는 지적이 있었는데, 전에는 민트색 22px 이라 눈에 잘
   * 들어오지 않았습니다.
   *
   * 이건 촬영 전 안내 그림입니다. 실제 카메라 화면 위에 겹치는 것이 아닙니다.
   * 그건 expo-camera 가 필요하고, 이 프로젝트는 폰 기본 카메라를 씁니다.
   * (AGENTS.md, SETUP.md)
   */
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: colors.green,
    borderWidth: 4,
  },
  cornerTL: {
    top: -4,
    left: -4,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.sm,
  },
  cornerTR: {
    top: -4,
    right: -4,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: radius.sm,
  },
  cornerBL: {
    bottom: -4,
    left: -4,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.sm,
  },
  cornerBR: {
    bottom: -4,
    right: -4,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: radius.sm,
  },

  /* 안내 문구 */
  tips: { marginTop: space.lg, gap: space.sm },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.mint,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontSize: font.small,
    color: colors.gray,
    lineHeight: 20,
  },

  /* 하단 */
  foot: { gap: space.sm },

  notice: {
    backgroundColor: colors.amberBg,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  noticeTitle: {
    fontSize: font.body,
    fontWeight: weight.semibold,
    color: colors.amber,
  },
  noticeBody: {
    marginTop: space.xs,
    fontSize: font.small,
    color: colors.navySoft,
    lineHeight: 20,
  },
  noticeButton: {
    marginTop: space.sm,
    alignSelf: "flex-start",
    minHeight: minTouch,
    justifyContent: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.amber,
  },
  noticeButtonPressed: { opacity: 0.6 },
  noticeButtonText: {
    fontSize: font.small,
    fontWeight: weight.semibold,
    color: colors.amber,
  },

  primary: {
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    minHeight: minTouch,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPressed: { backgroundColor: colors.navyPressed },
  primaryText: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },

  secondary: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    minHeight: minTouch,
    paddingVertical: space.md,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryPressed: { backgroundColor: colors.surface },
  secondaryText: {
    color: colors.navy,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },

  footNote: {
    marginTop: space.xs,
    textAlign: "center",
    fontSize: font.tiny,
    color: colors.gray,
    lineHeight: 18,
  },

  dim: { opacity: 0.5 },
});

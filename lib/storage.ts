/**
 * 폰 안에만 저장합니다. 서버에는 저장하지 않습니다.
 *
 *  - 사진: 앱 전용 문서 폴더의 contracts/ 에 복사 (앱을 지우면 함께 삭제)
 *  - 판정 결과: AsyncStorage
 *
 * 화면에서는 saveResult / loadHistory / getResult / deleteResult 만 쓰면 됩니다.
 *
 * 참고: Expo SDK 54부터 expo-file-system 이 새 API로 바뀌었습니다.
 * 아래 import 에서 에러가 나면 "expo-file-system/legacy" 를
 * "expo-file-system" 으로 바꿔보세요.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import type { InspectResult } from "../types";

const HISTORY_KEY = "albacheck:history";
const PHOTO_DIR = FileSystem.documentDirectory + "contracts/";

/* ---------- 사진 ---------- */

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

/**
 * 촬영 직후 사진은 캐시에 있어서 언제든 지워질 수 있습니다.
 * 기록함에 남기려면 문서 폴더로 복사해야 합니다.
 */
async function savePhoto(tempUri: string, id: string): Promise<string> {
  try {
    await ensureDir();
    const dest = `${PHOTO_DIR}${id}.jpg`;
    await FileSystem.copyAsync({ from: tempUri, to: dest });
    return dest;
  } catch {
    // 사진 복사가 실패해도 판정 결과는 남겨야 하므로 빈 경로로 진행
    return "";
  }
}

async function deletePhoto(path: string) {
  if (!path) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // 이미 없으면 무시
  }
}

/* ---------- 기록 ---------- */

/** 저장된 기록 전체 (최신순) */
export async function loadHistory(): Promise<InspectResult[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InspectResult[]) : [];
  } catch {
    return [];
  }
}

/**
 * 결과 저장. 사진 복사까지 한 번에 처리합니다.
 * id는 서버가 준 값을 그대로 씁니다. (사진 파일명이 이 id로 정해집니다)
 */
export async function saveResult(
  result: InspectResult,
  tempPhotoUri?: string
): Promise<InspectResult> {
  const imagePath = tempPhotoUri
    ? await savePhoto(tempPhotoUri, result.id)
    : result.imagePath;

  const saved: InspectResult = { ...result, imagePath };
  const history = await loadHistory();
  const next = [saved, ...history.filter((r) => r.id !== saved.id)];

  /**
   * 기록함에 남기지 못해도 판정 결과는 돌려줍니다.
   *
   * 여기서 throw 하면 analyzing.tsx 의 catch 가 그걸 "server" 에러로 받아서
   * 이미 분석이 끝난 계약서에 "지금은 분석할 수 없어요" 를 띄웁니다.
   * 사용자는 이유도 모르고, AI 호출 비용도 이미 나갔습니다.
   *
   * 저장 실패는 저장공간 부족처럼 드문 경우입니다. 기록이 안 남는 것보다
   * 판정 결과를 잃는 쪽이 훨씬 나쁩니다. 위의 savePhoto 도 같은 이유로
   * 실패를 삼키고 빈 경로를 돌려줍니다.
   */
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("[storage] 기록함 저장 실패. 판정 결과는 그대로 보여줍니다.", e);
  }

  return saved;
}

/** 이미 저장된 기록 갱신 (이름 붙이기, 말 꺼냄 여부 기록 등) */
export async function updateResult(
  id: string,
  patch: Partial<InspectResult>
): Promise<void> {
  const history = await loadHistory();
  const next = history.map((r) => (r.id === id ? { ...r, ...patch } : r));
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

/** id로 하나 가져오기 */
export async function getResult(id: string): Promise<InspectResult | null> {
  const history = await loadHistory();
  return history.find((r) => r.id === id) ?? null;
}

/** 하나 삭제 (사진도 같이 지움) */
export async function deleteResult(id: string): Promise<void> {
  const history = await loadHistory();
  const target = history.find((r) => r.id === id);
  if (target) await deletePhoto(target.imagePath);
  await AsyncStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.filter((r) => r.id !== id))
  );
}

/** 전체 삭제 */
export async function clearAll(): Promise<void> {
  const history = await loadHistory();
  await Promise.all(history.map((r) => deletePhoto(r.imagePath)));
  await AsyncStorage.removeItem(HISTORY_KEY);
}

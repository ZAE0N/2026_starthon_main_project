/**
 * 화면 전환 중에 현재 판정 결과를 담아두는 곳.
 *
 * 왜 필요한가:
 *   analyzing → result → clause/[id] → script
 *   이 네 화면이 같은 결과를 봐야 하는데, expo-router 파라미터로
 *   객체를 넘기면 문자열로 바뀌면서 지저분해지고 길면 잘립니다.
 *   그래서 여기에 담아두고 각 화면이 꺼내 씁니다.
 *
 * 사용법:
 *   // 분석이 끝났을 때
 *   setCurrent(result);
 *   router.replace("/result");
 *
 *   // 결과 화면에서
 *   const result = useCurrent();
 *   if (!result) return null;   // 앱을 껐다 켜면 비어 있을 수 있음
 *
 * 주의: 앱을 완전히 껐다 켜면 사라집니다.
 *      영구 보관은 lib/storage.ts 를 씁니다.
 */

import { useSyncExternalStore } from "react";
import type { FollowUp, InspectResult, Photo } from "../types";

let current: InspectResult | null = null;
let currentPhoto: Photo | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 현재 결과를 설정합니다. (분석 완료 시) */
export function setCurrent(result: InspectResult | null) {
  current = result;
  emit();
}

/** 훅 없이 꺼내기 */
export function getCurrent(): InspectResult | null {
  return current;
}

/** 화면에서 쓰는 훅. 값이 바뀌면 자동으로 다시 그려집니다. */
export function useCurrent(): InspectResult | null {
  return useSyncExternalStore(subscribe, getCurrent, getCurrent);
}

/** 사용자가 실제로 말을 꺼냈는지 기록 (핵심 지표) */
export function setFollowUp(value: FollowUp) {
  if (!current) return;
  current = { ...current, followUp: value };
  emit();
}

/** 기록함에 표시할 이름 붙이기 */
export function setTitle(title: string) {
  if (!current) return;
  current = { ...current, title };
  emit();
}

/* ------------------------------------------------------------------ */
/* 사진                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 촬영·갤러리에서 얻은 사진을 담아둡니다.
 *
 *   // 촬영 화면 (camera.tsx)
 *   const photo = await takePhoto();
 *   if (!photo) return;            // 취소했거나 권한 거부
 *   setCurrentPhoto(photo);
 *   router.replace("/analyzing");
 *
 *   // 분석 화면 (analyzing.tsx)
 *   const photo = getCurrentPhoto();
 *   if (!photo) { router.replace("/camera"); return null; }
 *   const result = await inspectContract(photo.base64);
 *
 * base64 는 수십만 자라 라우터 파라미터로 넘기면 잘립니다. 반드시 여기를 쓰세요.
 */
export function setCurrentPhoto(photo: Photo | null) {
  currentPhoto = photo;
  emit();
}

/** 훅 없이 꺼내기 */
export function getCurrentPhoto(): Photo | null {
  return currentPhoto;
}

/** 화면에서 쓰는 훅 */
export function useCurrentPhoto(): Photo | null {
  return useSyncExternalStore(subscribe, getCurrentPhoto, getCurrentPhoto);
}

/**
 * 새로 촬영할 때 초기화.
 * 사진까지 같이 비웁니다. 안 비우면 이전 계약서 사진이 다음 결과에 붙습니다.
 */
export function clearCurrent() {
  current = null;
  currentPhoto = null;
  emit();
}

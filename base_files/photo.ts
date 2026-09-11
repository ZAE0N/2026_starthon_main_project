/**
 * 사진 가져오기.
 *
 * 촬영 화면에서 직접 base64를 만들려고 하지 말고 여기 함수를 쓰세요.
 * 용량을 줄이지 않으면 실제 계약서 사진에서 서버가 거부합니다.
 * (작은 테스트 사진으로는 통과하고 진짜 사진에서만 실패해서 원인 찾기가 어렵습니다.)
 */

import * as ImagePicker from "expo-image-picker";

export type Photo = {
  /** 임시 파일 경로. 저장하려면 lib/storage.ts 의 saveResult 에 넘깁니다. */
  uri: string;
  /** 서버로 보낼 값 */
  base64: string;
};

/** 촬영 옵션. 용량을 줄이는 게 핵심입니다. */
const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.5,
  base64: true,
  exif: false,
  allowsEditing: false,
};

function toPhoto(result: ImagePicker.ImagePickerResult): Photo | null {
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.base64) return null;
  return { uri: asset.uri, base64: asset.base64 };
}

/**
 * 카메라로 찍기.
 * 권한이 없으면 null 을 돌려주니, 화면에서 안내를 띄우세요.
 * (copy.errors.permission)
 */
export async function takePhoto(): Promise<Photo | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  return toPhoto(await ImagePicker.launchCameraAsync(OPTIONS));
}

/**
 * 갤러리에서 고르기.
 * 이미 계약서를 쓰고 사진만 남은 사용자를 위한 경로입니다.
 * 시연 때 조명이 나쁘면 미리 찍어둔 사진으로 대체할 수도 있습니다.
 */
export async function pickPhoto(): Promise<Photo | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  return toPhoto(await ImagePicker.launchImageLibraryAsync(OPTIONS));
}

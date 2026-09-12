/**
 * 사진 가져오기.
 *
 * 촬영 화면에서 직접 base64를 만들려고 하지 말고 여기 함수를 쓰세요.
 * 용량을 줄이지 않으면 실제 계약서 사진에서 서버가 거부합니다.
 * (작은 테스트 사진으로는 통과하고 진짜 사진에서만 실패해서 원인 찾기가 어렵습니다.)
 */

import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import type { Photo } from "../types";

export type { Photo };

/**
 * 긴 변을 이 크기로 줄입니다.
 *
 * quality 만으로는 부족합니다. quality 는 JPEG 압축률만 바꾸고 해상도는 그대로라,
 * 요즘 폰 12MP 사진은 quality 를 낮춰도 1~2MB 이고 base64 로 바뀌며 1.33배 더 커집니다.
 * 1600px 면 계약서 본문 글자를 읽기에 충분하면서 전송량이 1/4 수준으로 내려갑니다.
 */
const MAX_EDGE = 1600;

/** 저장할 때 압축률. 0.7 이면 글자는 살아 있고 용량은 확실히 줄어듭니다. */
const COMPRESS = 0.7;

/**
 * 촬영·선택 옵션.
 * 여기서는 base64 를 받지 않습니다. 축소한 다음에 만들어야 용량이 줄기 때문입니다.
 */
const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 1,
  base64: false,
  exif: false,
  allowsEditing: false,
};

/**
 * 긴 변이 MAX_EDGE 를 넘으면 줄이고 base64 를 만듭니다.
 * 축소가 실패해도 원본을 그대로 읽어 분석은 진행합니다.
 * (용량이 커지는 것보다 분석 자체를 못 하는 게 더 나쁩니다)
 */
async function toPhoto(
  result: ImagePicker.ImagePickerResult
): Promise<Photo | null> {
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  const width = asset.width ?? 0;
  const height = asset.height ?? 0;

  try {
    const context = ImageManipulator.manipulate(asset.uri);

    if (Math.max(width, height) > MAX_EDGE) {
      // 한쪽만 지정하면 나머지는 비율에 맞춰 자동 계산됩니다.
      context.resize(
        width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE }
      );
    }

    const image = await context.renderAsync();
    const out = await image.saveAsync({
      compress: COMPRESS,
      format: SaveFormat.JPEG,
      base64: true,
    });

    if (out.base64) return { uri: out.uri, base64: out.base64 };
  } catch {
    // 축소 실패 — 아래 원본 경로로 넘어갑니다.
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: "base64",
    });
    return { uri: asset.uri, base64 };
  } catch {
    return null;
  }
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

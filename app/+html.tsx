/**
 * 웹에서만 쓰이는 껍데기. 담당: 전정현
 *
 * expo-router 가 웹으로 빌드할 때만 이 파일을 씁니다. 폰(네이티브)에서는
 * 아예 읽지 않습니다. 그래서 여기를 고쳐도 앱 동작에는 영향이 없습니다.
 *
 * 왜 필요한가:
 *   브라우저로 화면을 확인할 때 가로로 쭉 펼쳐져서 폰에서의 모습을 알 수 없었습니다.
 *   폰 연결이 안 되는 상황에서 브라우저가 유일한 확인 수단인데, 너비가 다르면
 *   줄바꿈과 여백이 실제와 달라 확인의 의미가 없습니다.
 *
 *   그래서 웹에서는 폰 너비로 가두고 화면 가운데에 둡니다.
 *
 * 너비 420px 은 요즘 폰의 논리 너비(390~430)에 맞춘 값입니다.
 * 더 좁게 보려면 아래 PHONE_WIDTH 만 바꾸면 됩니다.
 */

import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/** 폰 화면 너비 (CSS px) */
const PHONE_WIDTH = 420;

/**
 * 바깥 여백 색은 theme.ts 의 surface(#F7F9FC), 안쪽은 bg(#FFFFFF) 와 같은 값입니다.
 * 여기서는 CSS 문자열이라 theme 을 import 해서 쓸 수 없어 값을 적었습니다.
 * theme.ts 에서 색을 바꾸면 이쪽도 같이 고쳐야 합니다.
 */
const style = `
  html,
  body {
    height: 100%;
    margin: 0;
    background-color: #F7F9FC;
  }

  /*
    expo-router 가 앱을 이 안에 그립니다. 마운트 지점이 #root 인 것은
    웹 실행 로그에서 확인했습니다.
      Running application "main" with appParams: {"rootTag": "#root"}

    overflow 는 건드리지 않습니다. ScrollViewStyleReset 이 스크롤 관련
    속성을 이미 넣는데, 여기서 또 지정하면 화면이 잘릴 수 있습니다.
  */
  #root {
    width: 100%;
    max-width: ${PHONE_WIDTH}px;
    margin: 0 auto;
    background-color: #FFFFFF;
    /* 폰처럼 보이게 좌우 경계를 줍니다. 실제 폰에는 없는 장식입니다 */
    box-shadow: 0 0 0 1px #E6E9EF;
  }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/*
          react-native-web 의 ScrollView 가 웹에서 제대로 스크롤되게 맞춰줍니다.
          expo-router 가 제공하는 것이고, 빼면 화면이 스크롤되지 않습니다.
        */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: style }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

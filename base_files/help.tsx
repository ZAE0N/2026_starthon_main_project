'use client';

import React from 'react';

export interface HelpProps {
  onBack?: () => void;
  onGoHistory?: () => void;
}

export default function HelpPage({ onBack, onGoHistory }: HelpProps) {
  return (
    <div className="flex flex-col h-full justify-between p-5 bg-white text-navy">
      {/* 헤더 및 안내 문구 */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="text-xl py-1 mb-2 hover:opacity-70 transition-opacity"
          aria-label="뒤로가기"
        >
          ←
        </button>
        <h3 className="text-xl font-bold tracking-tight">
          혼자 해결이<br />
          어려울 때
        </h3>
        <p className="text-xs text-gray mt-2.5 mb-5 leading-relaxed">
          전화하면 노무사가 무료로 상담해줘요.<br />
          기록해둔 계약서를 보여주면 더 빨라요.
        </p>

        {/* 무료 상담센터 목록 */}
        <div className="flex flex-col gap-3">
          {/* 청소년근로권익센터 */}
          <div className="border border-line rounded-2xl p-4 bg-white">
            <div className="text-sm font-semibold">청소년근로권익센터</div>
            <div className="text-xs text-gray mt-1 leading-relaxed">
              만 24세 이하 무료 상담 · 평일 9시~18시
            </div>
            <a
              href="tel:1644-3119"
              className="block text-lg font-bold text-mint-dark mt-3 tracking-tight hover:underline"
            >
              1644-3119
            </a>
          </div>

          {/* 고용노동부 고객상담센터 */}
          <div className="border border-line rounded-2xl p-4 bg-white">
            <div className="text-sm font-semibold">고용노동부 고객상담센터</div>
            <div className="text-xs text-gray mt-1 leading-relaxed">
              임금체불·부당해고 신고 안내
            </div>
            <a
              href="tel:1350"
              className="block text-lg font-bold text-mint-dark mt-3 tracking-tight hover:underline"
            >
              1350
            </a>
          </div>
        </div>
      </div>

      {/* 하단 기록보기 버튼 */}
      <div className="pt-4">
        <button
          type="button"
          onClick={onGoHistory}
          className="w-full bg-white border border-line hover:bg-gray-50 font-semibold py-3.5 rounded-xl text-sm transition-colors"
        >
          내 기록 보기
        </button>
      </div>
    </div>
  );
}
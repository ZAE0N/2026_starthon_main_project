'use client';

import React from 'react';

export interface LandingProps {
  onNext?: () => void;
}

export default function LandingPage({ onNext }: LandingProps) {
  return (
    <div className="flex flex-col h-full justify-between p-5 bg-white text-navy">
      {/* 상단/중앙 문구 및 카드 */}
      <div className="flex-1 flex flex-col justify-center py-4">
        <h2 className="text-2xl font-bold leading-snug tracking-tight">
          서명하기 전<br />
          3분이면 됩니다
        </h2>
        <p className="mt-4 text-sm text-navy-soft leading-relaxed">
          계약서를 사진으로 찍으면<br />
          무엇이 잘못됐는지, 그리고<br />
          사장님께 뭐라고 말할지 알려드려요.
        </p>
        
        {/* 통계 지표 카드 */}
        <div className="mt-7 border-l-4 border-mint pl-3.5 py-0.5">
          <div className="text-3xl font-bold tracking-tight">89%</div>
          <div className="text-xs text-gray mt-1 leading-snug">
            부당한 일을 겪고도<br />
            아무 말 없이 넘어갑니다
          </div>
        </div>
      </div>

      {/* 하단 버튼 영역 */}
      <div className="pt-4">
        <button
          type="button"
          onClick={onNext}
          className="w-full bg-mint hover:bg-mint-dark text-white font-semibold py-3.5 rounded-xl text-base transition-colors shadow-sm"
        >
          계약서 촬영하기
        </button>
        <div className="text-center text-xs text-gray mt-3">
          사진은 폰에만 저장되고 서버로 보내지 않아요
        </div>
      </div>
    </div>
  );
}
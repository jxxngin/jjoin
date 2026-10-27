"use client";

import { useEffect } from "react";
import { markInquiryRead } from "../actions";

// 문의 화면을 열면 그 문의의 답변 알림을 읽음으로 바꾼다. (머리글 종의 점도 다시 그린다)
export function MarkInquiryRead({ inquiryId }: { inquiryId: string }) {
  useEffect(() => {
    markInquiryRead(inquiryId);
  }, [inquiryId]);
  return null;
}

"use client";

import { startTransition, type FormEvent } from "react";

// <form action={...}>은 보낸 뒤 입력칸을 모두 비운다. 그래서 서버가 "지난 날짜예요" 같은 오류를 돌려주면
// 제목·장소·메모까지 다시 써야 했다. 대신 onSubmit으로 직접 보내서 입력한 내용을 그대로 둔다.
// 쓰는 법: <form onSubmit={keepFormOnSubmit(formAction)}>
export function keepFormOnSubmit(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
}

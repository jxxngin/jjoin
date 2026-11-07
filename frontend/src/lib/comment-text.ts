// 언급은 댓글 맨 앞에 "@민수 @지원 "처럼 저장된다. (comment-form.tsx)
// 이름은 mentionToken으로 공백·@를 _로 바꿔 저장하므로 "@이름 " 하나가 늘 공백 하나로 끝난다. (닉네임에 공백이 있어도 경계가 깨지지 않음)
// 그 앞부분(언급)과 나머지(내용)를 나눈다. 화면은 언급을 지금 닉네임으로 다시 그리고,
// 댓글을 고칠 때는 언급은 그대로 두고 내용만 바꾼다. 화면과 서버가 같이 쓴다.
export function splitMentions(body: string, count: number) {
  let rest = body;
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const match = /^@([^\s@]+) /.exec(rest);
    if (!match) break;
    rest = rest.slice(match[0].length);
    names.push(match[1]);
  }
  return { prefix: body.slice(0, body.length - rest.length), names, rest };
}

// 댓글에 저장할 언급 이름. 공백과 @를 _로 바꾼다. (보여 줄 때는 언급한 사람의 지금 닉네임을 쓴다)
export function mentionToken(nickname: string) {
  return nickname.trim().replace(/[\s@]+/g, "_") || "_";
}

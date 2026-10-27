// 언급은 댓글 맨 앞에 "@민수 @지원 "처럼 저장된다. (comment-form.tsx)
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

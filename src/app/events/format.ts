// "3~6명", "3명 이상", "최대 6명". 둘 다 없으면 null.
export function formatPeople(min: number | null, max: number | null) {
  if (min && max) return min === max ? `${min}명` : `${min}~${max}명`;
  if (min) return `${min}명 이상`;
  if (max) return `최대 ${max}명`;
  return null;
}

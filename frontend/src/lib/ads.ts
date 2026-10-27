import "server-only";

// 홈 하단 광고 배너. 내용은 GitHub에 올리지 않도록 환경 변수 ADS_JSON에 두고,
// 이미지는 Supabase Storage의 ads 저장소에 둔다. (.env.example 참고)
export type Ad =
  | { id: string; src: string; alt: string; action: "copy"; value: string; done: string }
  | { id: string; src: string; alt: string; action: "link"; href: string };

function isAd(value: unknown): value is Ad {
  if (!value || typeof value !== "object") return false;
  const ad = value as Record<string, unknown>;
  const base = typeof ad.id === "string" && typeof ad.src === "string" && typeof ad.alt === "string";
  if (ad.action === "copy") return base && typeof ad.value === "string" && typeof ad.done === "string";
  if (ad.action === "link") return base && typeof ad.href === "string" && ad.href.startsWith("https://");
  return false;
}

// 형식이 틀린 항목은 버린다. 값이 없거나 깨져 있으면 배너를 보여 주지 않는다.
export function getAds(): Ad[] {
  const raw = process.env.ADS_JSON;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isAd) : [];
  } catch {
    console.error("ADS_JSON 형식이 올바르지 않아요.");
    return [];
  }
}

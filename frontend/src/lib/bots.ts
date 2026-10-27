// 카카오톡 등 링크 미리보기를 만드는 크롤러. 로그인을 못 하므로 공유용 페이지(/share/...)를 따로 보여 준다.
// next.config.ts의 htmlLimitedBots에도 같은 목록을 쓴다. (그쪽은 이 파일을 불러올 수 없어 똑같이 적어 둠)
export const LINK_PREVIEW_BOTS =
  /kakaotalk-scrap|facebookexternalhit|facebookcatalog|Twitterbot|Slackbot|Discordbot|TelegramBot|LinkedInBot|WhatsApp|Applebot|Yeti|Daum|Line\//i;

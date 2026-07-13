/**
 * Intl.DisplayNames API를 활용하여 ISO 국가 코드로부터 
 * 다국어(ko, en 등)에 맞는 공식 번역 국가명을 반환합니다.
 */
export const getCountryName = (code: string | null | undefined, lang: string): string => {
  if (!code) return "";
  const cleanCode = code.trim().toUpperCase();
  
  // UNKNOWN 또는 기타 식별할 수 없는 코드인 경우 폴백
  if (cleanCode === "UNKNOWN" || cleanCode === "") {
    return "";
  }

  try {
    const locale = lang === "ko" ? "ko" : "en";
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return displayNames.of(cleanCode) || cleanCode;
  } catch (error) {
    return cleanCode;
  }
};

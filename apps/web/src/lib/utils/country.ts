import { getKoreanCountryName, ISO_COUNTRY_NAMES_KO } from '@community/shared-types';

export { ISO_COUNTRY_NAMES_KO };

/**
 * ISO 국가 코드 또는 원본 국가명으로부터 다국어(ko, en 등)에 맞는 직관적인 국가명을 반환합니다.
 */
export const getCountryName = (codeOrName: string | null | undefined, lang: string = 'ko'): string => {
  return getKoreanCountryName(codeOrName, lang);
};

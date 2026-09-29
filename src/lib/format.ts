/** 로컬 기준 오늘 (YYYY-MM-DD) */
export const today = () => new Date().toLocaleDateString('sv-SE')
/** 상단바 표시용: 2026-09-29 (화) */
export const todayLabel = () => `${today()} (${'일월화수목금토'[new Date().getDay()]})`
export const won = (n: number) => n.toLocaleString('ko-KR')
/** 파일 크기: 512 B · 12.3 KB · 4.5 MB */
export const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`
/** 로컬 시각: YYYY-MM-DD HH:mm */
export const dateTime = (ms: number) => new Date(ms).toLocaleString('sv-SE').slice(0, 16)

export const REGIONS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원특별자치도', '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
]

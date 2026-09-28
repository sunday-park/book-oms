// 출고 입력 화면의 저장하지 않은 변경 여부를 사이드바 등 다른 컴포넌트와 공유한다.
let unsaved = false
export const setUnsaved = (v: boolean) => {
  unsaved = v
}
export const hasUnsaved = () => unsaved

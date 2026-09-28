// 한글 음절의 받침 유무에 따라 알맞은 조사를 고른다. 한글 음절이 아니면 받침 없는 쪽을 쓴다.
export function josa(word: string, withBatchim: string, withoutBatchim: string) {
  const code = word.charCodeAt(word.length - 1)
  const hasBatchim = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0
  return hasBatchim ? withBatchim : withoutBatchim
}

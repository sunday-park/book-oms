import {
  BookCopy,
  BookOpen,
  Boxes,
  Building2,
  Copy,
  FileText,
  type LucideIcon,
  Package,
  Printer,
  Store,
  TrendingDown,
  Undo2,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: LucideIcon; desc: string; help: string[] }

// 관리 메뉴는 [도서·서점·출판사] / [입고·반품] 두 묶음 사이에 희미한 구분선
export const NAV: { title: string; groups: NavItem[][] }[] = [
  {
    title: '관리',
    groups: [
      [
        {
          href: '/books',
          label: '도서 관리',
          icon: BookOpen,
          desc: '도서 마스터 데이터를 관리합니다.',
          help: ['출판사를 선택하면 해당 출판사 도서만 표시됩니다.', '행을 클릭해 선택한 뒤 [수정]으로 편집·삭제합니다.', '도서코드는 등록 시 출판사별 순번으로 자동 부여됩니다.'],
        },
        {
          href: '/bookstores',
          label: '서점 관리',
          icon: Store,
          desc: '거래 서점의 코드·이름·지역을 관리합니다.',
          help: ['지역·서점명으로 목록을 좁혀 볼 수 있습니다.', '행을 클릭해 선택한 뒤 [수정]으로 편집·삭제합니다.', '출고·반품 이력이 있는 서점은 삭제할 수 없습니다.'],
        },
        {
          href: '/publishers',
          label: '출판사 관리',
          icon: Building2,
          desc: '출판사 정보와 연락처를 관리합니다.',
          help: ['출판사코드는 도서코드 앞자리로 쓰이며 등록 후 바꿀 수 없습니다.', '행을 클릭해 선택한 뒤 [수정]으로 편집·삭제합니다.', '소속 도서가 있는 출판사는 삭제할 수 없습니다.'],
        },
      ],
      [
        {
          href: '/receipts',
          label: '입고 관리',
          icon: Package,
          desc: '출판사에서 들어온 도서 입고 내역을 관리합니다.',
          help: ['기간·출판사·도서로 입고 내역을 조회합니다.', '[+ 등록]으로 입고를 추가하면 재고에 더해집니다.', '행을 선택한 뒤 [삭제]로 잘못 입력한 입고를 지웁니다.'],
        },
        {
          href: '/returns',
          label: '반품 관리',
          icon: Undo2,
          desc: '서점에서 돌아온 반품 내역을 관리합니다.',
          help: ['기간·출판사·서점으로 반품 내역을 조회합니다.', '[+ 등록]으로 반품을 추가하면 재고에 더해집니다.', '행을 선택한 뒤 [삭제]로 잘못 입력한 반품을 지웁니다.'],
        },
      ],
    ],
  },
  {
    title: '현황',
    groups: [[
      {
        href: '/status/shipments',
        label: '출고 현황',
        icon: TrendingDown,
        desc: '날짜별 서점 출고 내역을 조회합니다.',
        help: ['날짜를 고르면 그날의 출고 내역이 표시됩니다.', '출판사·서점으로 범위를 좁힐 수 있습니다.'],
      },
      {
        href: '/status/stock',
        label: '재고 현황',
        icon: Boxes,
        desc: '출판사별 도서의 입고·출고·반품·현재고를 조회합니다.',
        help: ['출판사를 선택하면 소속 도서의 재고가 표시됩니다.', '현재고가 음수이면 빨간색으로 표시됩니다.'],
      },
    ]],
  },
  {
    title: '명세서',
    groups: [[
      {
        href: '/statements/entry',
        label: '출고 입력',
        icon: FileText,
        desc: '서점별 출고 명세를 입력하고 저장합니다.',
        help: ['날짜·출판사·서점을 고르면 기존 명세를 불러옵니다.', '[+ 행 추가]로 도서를 추가하고 [저장]으로 확정합니다.', '인쇄된 행은 잠겨 수정·삭제할 수 없습니다.'],
      },
      {
        href: '/statements/print',
        label: '명세서 출력',
        icon: Printer,
        desc: '아직 인쇄하지 않은 거래명세서를 출력합니다.',
        help: ['날짜·출판사·서점을 고르면 미인쇄 도서만 표시됩니다.', '[출력] 후 확인하면 다음 출력에서 제외됩니다.'],
      },
      {
        href: '/statements/ledger',
        label: '재고 원장',
        icon: BookCopy,
        desc: '출판사별 재고 원장을 조회하고 출력합니다.',
        help: ['출판사를 선택하면 현재 기준 재고 원장이 표시됩니다.', '[출력]으로 원장을 인쇄합니다.'],
      },
      {
        href: '/statements/dispatch',
        label: '출고증',
        icon: Copy,
        desc: '날짜·출판사별 서점 출고증을 출력합니다.',
        help: ['날짜와 출판사를 고르면 서점별 출고증이 표시됩니다.', '[출력]으로 출고증을 인쇄합니다.'],
      },
    ]],
  },
]

export function findNav(pathname: string) {
  for (const s of NAV) for (const g of s.groups) for (const it of g) if (it.href === pathname) return { section: s.title, item: it }
  return undefined
}

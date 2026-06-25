import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { isValidMonthKey } from "./month";

export type SetSelectedMonth = (updater: string | ((m: string) => string)) => void;

/**
 * 홈/통계가 공유하는 ?month=YYYY-MM 쿼리스트링 기반 선택 월 상태.
 * 기본 월이면 파라미터를 생략해 URL을 깔끔하게 유지하고, 잘못된/없는 값은 기본 월로 폴백한다.
 * Phase 10에서 TabBar가 이 month 파라미터를 입력 탭으로 그대로 전달한다.
 */
export function useSelectedMonth(defaultMonthKey: string): [string, SetSelectedMonth] {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get("month");
  const selectedMonth = isValidMonthKey(monthParam) ? monthParam : defaultMonthKey;

  const setSelectedMonth = useCallback<SetSelectedMonth>(
    (updater) => {
      setSearchParams(
        (prev) => {
          const next = typeof updater === "function" ? updater(selectedMonth) : updater;
          const params = new URLSearchParams(prev);
          if (next === defaultMonthKey) params.delete("month");
          else params.set("month", next);
          return params;
        },
        { replace: true }
      );
    },
    [defaultMonthKey, selectedMonth, setSearchParams]
  );

  return [selectedMonth, setSelectedMonth];
}

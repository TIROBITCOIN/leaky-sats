import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { getCurrentMonthKey, isValidMonthKey } from "./month";

export type SetSelectedMonth = (updater: string | ((m: string) => string)) => void;

/**
 * 홈/통계가 공유하는 ?month=YYYY-MM 쿼리스트링 기반 선택 월 상태.
 * 현재 월이면 파라미터를 생략해 URL을 깔끔하게 유지하고, 잘못된/없는 값은 현재 월로 폴백한다.
 * Phase 10에서 TabBar가 이 month 파라미터를 입력 탭으로 그대로 전달한다.
 */
export function useSelectedMonth(): [string, SetSelectedMonth] {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get("month");
  const selectedMonth = isValidMonthKey(monthParam) ? monthParam : getCurrentMonthKey();

  const setSelectedMonth = useCallback<SetSelectedMonth>(
    (updater) => {
      setSearchParams(
        (prev) => {
          const next = typeof updater === "function" ? updater(selectedMonth) : updater;
          const params = new URLSearchParams(prev);
          if (next === getCurrentMonthKey()) params.delete("month");
          else params.set("month", next);
          return params;
        },
        { replace: true }
      );
    },
    [selectedMonth, setSearchParams]
  );

  return [selectedMonth, setSelectedMonth];
}

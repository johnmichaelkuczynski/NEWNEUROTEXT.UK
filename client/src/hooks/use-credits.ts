import { useQuery } from "@tanstack/react-query";

interface CreditBalanceData {
  credits: number;
  total: number;
  unlimited: boolean;
}

export function useCredits() {
  const { data, isLoading } = useQuery<CreditBalanceData>({
    queryKey: ["/api/credits/balance"],
    refetchInterval: 3000,
  });

  return {
    credits: data?.total ?? 0,
    unlimited: data?.unlimited ?? false,
    hasCredits: (data?.unlimited === true) || ((data?.total ?? 0) > 0),
    isLoading
  };
}

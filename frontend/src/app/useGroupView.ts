import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGroup, getGroups } from "../features/groups/api";
import { getBalances, getExpenses } from "../features/expenses/api";

export function useGroupView() {
  const [username, setUsername] = useState("alice");
  const [groupId, setGroupId] = useState("");
  const queryClient = useQueryClient();
  const groups = useQuery({ queryKey: ["groups", username], queryFn: () => getGroups(username) });
  const detail = useQuery({
    queryKey: ["group", username, groupId],
    queryFn: () => getGroup(username, Number(groupId)),
    enabled: groupId !== "",
  });
  const expenses = useQuery({
    queryKey: ["expenses", username, groupId],
    queryFn: () => getExpenses(username, Number(groupId)),
    enabled: groupId !== "",
  });
  const balances = useQuery({
    queryKey: ["balances", username, groupId],
    queryFn: () => getBalances(username, Number(groupId)),
    enabled: groupId !== "",
  });

  function changeUser(nextUser: string) {
    queryClient.removeQueries({ queryKey: ["groups"] });
    queryClient.removeQueries({ queryKey: ["group"] });
    queryClient.removeQueries({ queryKey: ["expenses"] });
    queryClient.removeQueries({ queryKey: ["balances"] });
    setGroupId("");
    setUsername(nextUser);
  }

  return { username, groupId, setGroupId, changeUser, groups, detail, expenses, balances };
}

import { getUsersSnapshot } from "@/app/actions/users";
import { UsersManager } from "../_components/users-manager";

export default async function UsersPage() {
  const snap = await getUsersSnapshot();
  return (
    <UsersManager
      initialUsers={snap.users}
      initialUnlinked={snap.unlinked}
      initialBoMon={snap.boMon}
    />
  );
}

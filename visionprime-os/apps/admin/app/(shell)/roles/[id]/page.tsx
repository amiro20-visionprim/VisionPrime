import { RoleForm } from "../RoleForm";

export default function EditRolePage({ params }: { params: { id: string } }) {
  return <RoleForm mode="edit" roleId={params.id} />;
}

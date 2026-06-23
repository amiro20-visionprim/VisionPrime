import { UserForm } from "../UserForm";

export default function EditUserPage({ params }: { params: { id: string } }) {
  return <UserForm mode="edit" userId={params.id} />;
}

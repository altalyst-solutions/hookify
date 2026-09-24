import { usePersistedState } from "@altalyst/hookify";
import type { ChangeEvent } from "react";

export const UserForm = () => {
  const [formData, setFormData] = usePersistedState<{
    name: string;
    email: string;
  }>("userForm", {
    name: "",
    email: "",
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      <h2>User Form</h2>
      <form>
        <label>
          Name:
          <input name="name" value={formData.name} onChange={handleChange} />
        </label>
        <br />
        <label>
          Email:
          <input name="email" value={formData.email} onChange={handleChange} />
        </label>
      </form>
    </div>
  );
};

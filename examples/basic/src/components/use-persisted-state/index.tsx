import { Counter } from "./components/counter";
import { ThemeSwitcher } from "./components/theme-switcher";
import { TodoList } from "./components/todo-list";
import { UserForm } from "./components/user-form";

export const UsePersistedState = () => {
  return (
    <>
      <Counter />
      <ThemeSwitcher />
      <TodoList />
      <UserForm />
    </>
  );
};

import { usePersistedState } from "@altalyst/hookify";
import { useState } from "react";

export const TodoList = () => {
  const [todos, setTodos] = usePersistedState<string[]>("todos", []);
  const [input, setInput] = useState("");

  const addTodo = () => {
    if (input.trim()) {
      setTodos((prev) => [...prev, input]);
      setInput("");
    }
  };

  const removeTodo = (index: number) => {
    setTodos((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2>To-Do List</h2>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.map((todo, index) => (
          <li key={index}>
            {todo} <button onClick={() => removeTodo(index)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

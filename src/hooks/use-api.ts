export const useApi = () => {
  console.log("Inside useApi hook.");

  return "useApi called";
};

export function helloAnything(thing: string): string {
  return `Hello ${thing}!`;
}

export type TTest = {
  text: string;
};

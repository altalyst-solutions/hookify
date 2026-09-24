// Ambient module declaration for the `!!raw-loader!` webpack import syntax.
// Used to pull real demo component source into <HookDemo /> so the code
// shown to consumers is always the exact code that runs.
declare module "!!raw-loader!*" {
  const contents: string;
  export default contents;
}

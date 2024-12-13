import { Link, Outlet } from "react-router-dom";

export const HooksPage = () => {
  return (
    <>
      <h1>Hooks Demo</h1>
      <nav>
        <ul>
          <li>
            <Link to={"/hooks/use-effect-after-mount"}>
              useEffectAfterMount hook
            </Link>
          </li>
          <li>
            <Link to={"/hooks/use-api"}>useApi hook</Link>
          </li>
          <li>
            <Link to={"/hooks/use-outside-click"}>useOutsideClick hook</Link>
          </li>
          <li>
            <Link to={"/hooks/use-toggle-state"}>useToggleState hook</Link>
          </li>
        </ul>
      </nav>
      <Outlet />
    </>
  );
};

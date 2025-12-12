import { createBrowserRouter } from "react-router-dom";

import { HooksPage } from "./routes/hooks.tsx";
import { UseApiPage } from "./routes/hooks/use-api.tsx";
import { UseControlledStatePage } from "./routes/hooks/use-controlled-state.tsx";
import { UseDebouncePage } from "./routes/hooks/use-debounce.tsx";
import { UseEffectAfterMountPage } from "./routes/hooks/use-effect-after-mount.tsx";
import { UseMountedPage } from "./routes/hooks/use-mounted.tsx";
import { UseOutsideClickPage } from "./routes/hooks/use-outside-click.tsx";
import { UsePersistedStatePage } from "./routes/hooks/use-persisted-state.tsx";
import { UseSequentialRequestPage } from "./routes/hooks/use-sequential-request.tsx";
import { UseToggleStatePage } from "./routes/hooks/use-toggle-state.tsx";
import { Root } from "./routes/root.tsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
  },
  {
    path: "/hooks",
    element: <HooksPage />,
    children: [
      {
        path: "/hooks/use-effect-after-mount",
        element: <UseEffectAfterMountPage />,
      },
      {
        path: "/hooks/use-api",
        element: <UseApiPage />,
      },
      {
        path: "/hooks/use-outside-click",
        element: <UseOutsideClickPage />,
      },
      {
        path: "/hooks/use-toggle-state",
        element: <UseToggleStatePage />,
      },
      {
        path: "/hooks/use-controlled-state",
        element: <UseControlledStatePage />,
      },
      {
        path: "/hooks/use-persisted-state",
        element: <UsePersistedStatePage />,
      },
      {
        path: "/hooks/use-debounce",
        element: <UseDebouncePage />,
      },
      {
        path: "/hooks/use-mounted",
        element: <UseMountedPage />,
      },
      {
        path: "/hooks/use-sequential-request",
        element: <UseSequentialRequestPage />,
      },
    ],
  },
]);

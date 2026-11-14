import { MarkAsRead } from "./MarkAsRead";
import { RepeatedViews } from "./RepeatedViews";
import { ViewTracker } from "./ViewTracker";

export default function App() {
  return (
    <>
      <ViewTracker />
      <MarkAsRead />
      <RepeatedViews />
    </>
  );
}

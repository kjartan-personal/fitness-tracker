import { BrowserRouter, Route, Routes } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import Today from "./screens/Today";
import LogWorkout from "./screens/LogWorkout";
import Nutrition from "./screens/Nutrition";
import Progress from "./screens/Progress";
import Settings from "./screens/Settings";

// Match the Vite base so routing works under the GitHub Pages subpath.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <div className="app">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/log" element={<LogWorkout />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

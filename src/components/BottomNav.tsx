import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Today", icon: "🏋️", end: true },
  { to: "/nutrition", label: "Nutrition", icon: "🍗", end: false },
  { to: "/progress", label: "Progress", icon: "📈", end: false },
  { to: "/settings", label: "Settings", icon: "⚙️", end: false },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end}>
          <span className="icon">{it.icon}</span>
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

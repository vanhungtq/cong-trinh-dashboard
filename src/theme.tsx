import { createContext, useContext, useState, type ReactNode } from "react";
import { Provider, Button, Tooltip } from "@gravity-ui/uikit";
import { Moon, Sun } from "lucide-react";
const ThemeContext = createContext({ dark: false, toggle: () => {} });
export function AppTheme({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("cong-trinh-theme") === "dark";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setDark((v) => {
      try {
        localStorage.setItem("cong-trinh-theme", v ? "light" : "dark");
      } catch {}
      return !v;
    });
  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      <Provider theme={dark ? "dark" : "light"} lang="en">
        {children}
      </Provider>
    </ThemeContext.Provider>
  );
}
export function ThemeSwitch() {
  const { dark, toggle } = useContext(ThemeContext);
  const label = dark
    ? "Chuyển sang giao diện sáng"
    : "Chuyển sang giao diện tối";
  return (
    <Tooltip content={label}>
      <Button view="flat" size="m" aria-label={label} onClick={toggle}>
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </Button>
    </Tooltip>
  );
}

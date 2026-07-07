import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { FiActivity, FiBookOpen, FiCalendar, FiCreditCard, FiGrid, FiLogOut, FiMenu, FiMessageCircle, FiMoon, FiRefreshCw, FiSettings, FiSmartphone, FiSun, FiTrendingUp, FiUser, FiUsers, FiX } from "react-icons/fi";
import BrandLogo from "./BrandLogo";
import ThemeToggle from "./ThemeToggle";
import { isRechargeLockedByPrelaunch, rechargePrelaunchMessage } from "../utils/prelaunchLock";
import iconPlanes from "../assets/icons/royal/planes.png";
import iconRecarga from "../assets/icons/royal/recarga.png";
import iconRetiro from "../assets/icons/royal/retiro.png";
import iconHistorial from "../assets/icons/royal/historial.png";
import iconEquipo from "../assets/icons/royal/equipo.png";
import iconWhatsapp from "../assets/icons/royal/whatsapp.png";
import iconAdmin from "../assets/icons/royal/admin.png";

const mainNavItems = [
  { to: "/home", label: "Inicio", icon: <FiGrid /> },
  { to: "/tasks", label: "Tareas IA", icon: <FiActivity /> },
  { to: "/levels", label: "Niveles", icon: <FiTrendingUp /> },
  { to: "/invite", label: "Equipo", icon: <FiUsers /> },
];

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem("royal_theme") || "light");
  const [mobilePanel, setMobilePanel] = useState(null);
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1101 : false));
  const [adminMobilePreview, setAdminMobilePreview] = useState(() => localStorage.getItem("royal_admin_mobile_preview") === "1");
  const [rechargeNotice, setRechargeNotice] = useState("");
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);
  const adminNavItem = useMemo(() => ({ to: "/admin", label: "Admin", icon: <FiSettings /> }), []);
  const navItems = useMemo(() => (user?.is_admin ? [...mainNavItems, adminNavItem] : mainNavItems), [user?.is_admin, adminNavItem]);
  const walletLinks = useMemo(() => [
    { to: "/levels", label: "Compra plan", iconImg: iconPlanes, note: "Activa o mejora tu nivel", tone: "buyplan" },
    { to: "/recharge", label: "Recargar", iconImg: iconRecarga, note: "Añadir garantía", tone: "recharge" },
    { to: "/withdraw", label: "Retirar", iconImg: iconRetiro, note: "Cobrar recompensa", tone: "withdraw" },
    { to: "/history", label: "Historial", iconImg: iconHistorial, note: "Movimientos y recompensas", tone: "history" },
  ], []);
  const menuLinks = useMemo(() => {
    const items = [
      { to: "/profile", label: "Perfil", iconEmoji: "👤", note: "Cuenta y accesos", tone: "profile" },
      { to: "/invite", label: "Equipo", iconImg: iconEquipo, note: "Invitaciones y comunidad", tone: "team" },
      { to: "/support", label: "Soporte", iconImg: iconWhatsapp, note: "Canales oficiales", tone: "support" },
      { to: "/news", label: "Noticias", iconEmoji: "📰", note: "Novedades y promociones", tone: "news" },
    ];
    if (user?.is_admin) items.push({ to: "/admin", label: "Panel Admin", iconImg: iconAdmin, note: "Gestión general", tone: "admin" });
    return items;
  }, [user?.is_admin]);
  const walletActive = ["/levels", "/recharge", "/withdraw", "/history", "/transactions"].some((path) => location.pathname.startsWith(path));
  const menuActive = ["/invite", "/profile", "/admin", "/support", "/news"].some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("royal_theme", theme);
  }, [theme]);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1101);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (user?.is_admin && adminMobilePreview) {
      localStorage.setItem("royal_admin_mobile_preview", "1");
    } else {
      localStorage.removeItem("royal_admin_mobile_preview");
    }
  }, [adminMobilePreview, user?.is_admin]);

  useEffect(() => { setMobilePanel(null); }, [location.pathname]);


  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (!rechargeNotice) return undefined;
    const timer = setTimeout(() => setRechargeNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [rechargeNotice]);

  const handleMobileRechargeClick = () => {
    if (isRechargeLockedByPrelaunch()) {
      setRechargeNotice(rechargePrelaunchMessage());
      return;
    }
    setMobilePanel(null);
    navigate("/recharge");
  };

  const renderMobilePanelIcon = (item) => {
    if (item.iconImg) {
      return <img src={item.iconImg} alt="" aria-hidden="true" />;
    }
    if (item.iconEmoji) {
      return <span className="mobile-panel-emoji" aria-hidden="true">{item.iconEmoji}</span>;
    }
    return item.icon;
  };


  return (
    <div className={`app-shell ${user?.is_admin && adminMobilePreview ? "admin-mobile-preview" : ""}`}>
      {user?.is_admin && adminMobilePreview && (
        <>
          <div className="admin-preview-badge">Xiaomi Redmi Note 13 Pro 5G · Vista 393×873</div>
          <button
            className="admin-preview-exit-btn"
            type="button"
            onClick={() => setAdminMobilePreview(false)}
            title="Volver al modo normal"
          >
            <FiSmartphone />
            <span>Modo normal</span>
          </button>
        </>
      )}
      <aside className="sidebar sidebar-minimal">
        <BrandLogo />
        <nav className="side-nav side-nav-minimal">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? "active" : ""}>
              {item.icon}<span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-title topbar-brand-lockup">
            <div className="brand-title-line">
              <img src="/royal-icon.svg" alt="Royal Imperial AI" />
              <div>
                <strong>RoyalImperial AI</strong>
                <span>Entrena la IA. Gana recompensas.</span>
              </div>
            </div>
          </div>

          <div className="mobile-top-brand" aria-label="Royal Imperial AI">
            <BrandLogo />
          </div>

          <div className="top-actions">
            {user?.is_admin && isDesktop && (
              <button
                className={`admin-device-toggle ${adminMobilePreview ? "active" : ""}`}
                type="button"
                onClick={() => setAdminMobilePreview((value) => !value)}
                title={adminMobilePreview ? "Volver a vista PC" : "Previsualizar como Xiaomi Redmi Note 13 Pro 5G"}
              >
                <FiSmartphone />
                <span>{adminMobilePreview ? "Vista PC" : "Modo celular"}</span>
              </button>
            )}
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <button className="icon-btn" type="button" onClick={logout} title="Cerrar sesión"><FiLogOut /></button>
          </div>
        </header>
        <div className="content-area">{children}</div>
      </main>
      <nav className="mobile-nav mobile-nav-compact" aria-label="Navegación móvil">
        <NavLink to="/home" className={({ isActive }) => isActive ? "active" : ""}>
          <FiGrid /><span>Inicio</span>
        </NavLink>
        <NavLink to="/tasks" className={({ isActive }) => isActive ? "active" : ""}>
          <FiActivity /><span>Tareas</span>
        </NavLink>
        <button type="button" className={walletActive || mobilePanel === "wallet" ? "active" : ""} onClick={() => setMobilePanel((p) => p === "wallet" ? null : "wallet")}>
          <FiCreditCard /><span>Wallet</span>
        </button>
        <button type="button" className={menuActive || mobilePanel === "menu" ? "active" : ""} onClick={() => setMobilePanel((p) => p === "menu" ? null : "menu")}>
          <FiMenu /><span>Menú</span>
        </button>
      </nav>
      {mobilePanel && (
        <div className="mobile-panel-backdrop" onClick={() => setMobilePanel(null)}>
          <section className="mobile-panel-card" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-panel-head">
              <div>
                <span className="eyebrow">Royal Imperial AI</span>
                <h3>{mobilePanel === "wallet" ? "Wallet" : "Menú"}</h3>
              </div>
              <button className="icon-btn" type="button" onClick={() => setMobilePanel(null)} aria-label="Cerrar menú"><FiX /></button>
            </div>
            <div className="mobile-panel-links">
              {(mobilePanel === "wallet" ? walletLinks : menuLinks).map((item) => (
                item.to === "/recharge" && isRechargeLockedByPrelaunch() ? (
                  <button
                    key={item.to}
                    type="button"
                    className={`mobile-panel-link mobile-panel-button tone-${item.tone || "default"}`}
                    onClick={handleMobileRechargeClick}
                  >
                    <span className="mobile-panel-link-icon">{renderMobilePanelIcon(item)}</span>
                    <span><strong>{item.label}</strong><small>Disponible desde el lanzamiento</small></span>
                  </button>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `mobile-panel-link tone-${item.tone || "default"} ${isActive ? "active" : ""}`}
                  >
                    <span className="mobile-panel-link-icon">{renderMobilePanelIcon(item)}</span>
                    <span><strong>{item.label}</strong><small>{item.note}</small></span>
                  </NavLink>
                )
              ))}
            </div>
            {mobilePanel === "menu" && (
              <div className="mobile-panel-foot-actions">
                <button
                  className="mobile-panel-action theme-action"
                  type="button"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  <span>{theme === "dark" ? <FiSun /> : <FiMoon />}</span>
                  <strong>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</strong>
                </button>
                <button className="mobile-panel-action logout-action" type="button" onClick={logout}>
                  <span><FiLogOut /></span>
                  <strong>Cerrar sesión</strong>
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

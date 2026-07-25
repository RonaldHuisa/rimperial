import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiActivity, FiAlertTriangle, FiArrowUpCircle, FiAward, FiBarChart2, FiCheckCircle, FiCopy, FiCreditCard, FiDatabase, FiDollarSign, FiEdit3, FiExternalLink, FiFilter, FiRefreshCw, FiSearch, FiShield, FiSliders, FiUser, FiUserPlus, FiUsers, FiMessageCircle, FiBookOpen, FiPlus, FiTrash2, FiUpload, FiGift, FiVideo, FiSave, FiX, FiKey, FiLogOut } from "react-icons/fi";
import api from "../services/api";
import { FaWhatsapp } from "react-icons/fa";
import MetricCard from "../components/MetricCard";

const tabs = [
  { key: "overview", label: "Resumen", icon: <FiBarChart2 /> },
  { key: "users", label: "Usuarios", icon: <FiUsers /> },
  { key: "tasks", label: "Tareas IA", icon: <FiActivity /> },
  { key: "deposits", label: "Recargas", icon: <FiCreditCard /> },
  { key: "withdrawals", label: "Retiros", icon: <FiDollarSign /> },
  { key: "levels", label: "Niveles", icon: <FiSliders /> },
  { key: "support", label: "Soporte", icon: <FiMessageCircle /> },
  { key: "prelaunch", label: "Pre-lanzamiento", icon: <FiVideo /> },
  { key: "news", label: "Noticias", icon: <FiBookOpen /> },
  { key: "redeemCodes", label: "Códigos", icon: <FiGift /> },
  { key: "roulette", label: "Ruleta", icon: <FiRefreshCw /> },
  { key: "creditPoints", label: "Puntos", icon: <FiAward /> },
  { key: "security", label: "Seguridad", icon: <FiShield /> },
];

const money = (value) => `${Number(value || 0).toFixed(2)} USDT`;
const shortDate = (value) => value ? new Date(value).toLocaleString() : "—";
const compact = (value) => Number(value || 0).toLocaleString();
const safeText = (value, fallback = "—") => value === null || value === undefined || value === "" ? fallback : value;
const shortAddress = (value) => {
  const text = String(value || "");
  if (text.length <= 18) return text || "—";
  return `${text.slice(0, 10)}...${text.slice(-8)}`;
};
const scanUrl = (network, address) => {
  if (!address) return "";
  if (network === "POLYGON-USDT") return `https://polygonscan.com/address/${address}`;
  if (network === "BEP20-USDT") return `https://bscscan.com/address/${address}`;
  return "";
};

function toDateTimeLocal(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  } catch (_) {
    return "";
  }
}

function AdminTable({ columns, rows, empty = "Sin registros." }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>{columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows?.length ? rows.map((row, idx) => (
            <tr key={row.id || idx}>{columns.map((col) => <td key={col.key}>{col.render ? col.render(row) : safeText(row[col.key])}</td>)}</tr>
          )) : <tr><td colSpan={columns.length} className="empty-cell">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

const ADMIN_PAGE_SIZE = 12;

function PaginationControls({ page = 1, total = 0, limit = ADMIN_PAGE_SIZE, onPageChange, loading = false }) {
  const totalPages = Math.max(1, Math.ceil(Number(total || 0) / Number(limit || ADMIN_PAGE_SIZE)));
  if (totalPages <= 1) return null;
  return (
    <div className="pagination-row admin-pagination">
      <button className="secondary-btn" type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={loading || page <= 1}>Anterior</button>
      <span>Página {page} de {totalPages} · {compact(total)} registros</span>
      <button className="secondary-btn" type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={loading || page >= totalPages}>Siguiente</button>
    </div>
  );
}

function PaginatedAdminTable({ columns, rows = [], empty = "Sin registros.", pageSize = ADMIN_PAGE_SIZE }) {
  const [page, setPage] = useState(1);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => { setPage(1); }, [total, pageSize]);
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <>
      <AdminTable columns={columns} rows={visibleRows} empty={empty} />
      <PaginationControls page={safePage} total={total} limit={pageSize} onPageChange={setPage} />
    </>
  );
}

function StatusBadge({ children, tone = "neutral" }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

function AdminSummaryKpi({ icon, label, value, note, tone = "brand" }) {
  return (
    <article className={`admin-summary-kpi tone-${tone}`}>
      <div className="admin-summary-kpi-icon" aria-hidden="true">{icon}</div>
      <div className="admin-summary-kpi-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </article>
  );
}

function AdminHeader({ activeTab, setActiveTab, onRefresh, loading }) {
  const navigate = useNavigate();
  const changeTab = (key) => {
    setActiveTab(key);
    navigate(key === "overview" ? "/admin" : `/admin/${key}`);
  };

  return (
    <div className="admin-header-stack">
      <header className="admin-workspace-header">
        <div>
          <span className="eyebrow">Panel administrativo</span>
          <h1>Royal Imperial AI</h1>
          <p>Control general de usuarios, actividad financiera y operación de la plataforma.</p>
        </div>
        <div className="admin-header-actions">
          <button className="admin-user-mode-button" type="button" onClick={() => navigate("/home")}>
            <FiUser />
            <span>Modo usuario</span>
          </button>
          <button className="admin-refresh-button" type="button" onClick={onRefresh} disabled={loading}>
            <FiRefreshCw className={loading ? "is-spinning" : ""} />
            <span>{loading ? "Actualizando" : "Actualizar"}</span>
          </button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Secciones administrativas">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? "active" : ""}
            onClick={() => changeTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function OverviewPanel({ data }) {
  const s = data?.stats || {};
  const levels = data?.levels || [];
  const maxLevelUsers = Math.max(1, ...levels.map((level) => Number(level.activeUsers || 0)));

  return (
    <div className="admin-overview">
      <section className="admin-overview-section">
        <div className="admin-section-heading">
          <div>
            <span>Usuarios</span>
            <h2>Registro de la comunidad</h2>
          </div>
          <small>Cortes calculados en GMT-5</small>
        </div>
        <div className="admin-summary-grid grid-three">
          <AdminSummaryKpi
            icon={<FiUsers />}
            label="Usuarios totales"
            value={compact(s.users?.total_users)}
            note={`${compact(s.users?.total_admins)} administradores incluidos`}
          />
          <AdminSummaryKpi
            icon={<FiUserPlus />}
            label="Registros últimos 7 días"
            value={compact(s.users?.new_users_7d)}
            note="Ventana móvil de siete días"
            tone="success"
          />
          <AdminSummaryKpi
            icon={<FiUserPlus />}
            label="Registrados ayer"
            value={compact(s.users?.new_users_yesterday)}
            note="Día calendario anterior"
            tone="gold"
          />
        </div>
      </section>

      <section className="admin-overview-section">
        <div className="admin-section-heading">
          <div>
            <span>Finanzas</span>
            <h2>Recargas y retiros confirmados</h2>
          </div>
          <small>Incluye recargas confirmadas y créditos manuales de administrador</small>
        </div>
        <div className="admin-summary-grid grid-finance">
          <AdminSummaryKpi
            icon={<FiCreditCard />}
            label="Recargado total"
            value={money(s.deposits?.totalDeposited)}
            note={`${compact(s.deposits?.totalDeposits)} operaciones`}
          />
          <AdminSummaryKpi
            icon={<FiCreditCard />}
            label="Recargado últimos 7 días"
            value={money(s.deposits?.deposited7d)}
            note={`${compact(s.deposits?.deposits7d)} operaciones`}
            tone="success"
          />
          <AdminSummaryKpi
            icon={<FiCreditCard />}
            label="Recargado ayer"
            value={money(s.deposits?.depositedYesterday)}
            note={`${compact(s.deposits?.depositsYesterday)} operaciones`}
            tone="gold"
          />
          <AdminSummaryKpi
            icon={<FiDollarSign />}
            label="Total retirado"
            value={money(s.withdrawals?.totalPaid)}
            note={`${compact(s.withdrawals?.paidWithdrawals)} retiros pagados`}
            tone="danger"
          />
          <AdminSummaryKpi
            icon={<FiDollarSign />}
            label="Retirado últimos 7 días"
            value={money(s.withdrawals?.paid7d)}
            note={`${compact(s.withdrawals?.paidWithdrawals7d)} retiros pagados`}
            tone="danger"
          />
        </div>
      </section>

      <section className="admin-overview-section">
        <div className="admin-section-heading">
          <div>
            <span>Actividad</span>
            <h2>Usuarios que entrenan la IA</h2>
          </div>
          <small>Usuarios únicos con al menos una respuesta en los últimos 7 días</small>
        </div>
        <div className="admin-summary-grid grid-three">
          <AdminSummaryKpi
            icon={<FiActivity />}
            label="Pasantía activa"
            value={compact(s.activity?.trialActiveUsers7d)}
            note={`${compact(s.activity?.trialResponses7d)} respuestas realizadas`}
          />
          <AdminSummaryKpi
            icon={<FiCheckCircle />}
            label="Miembros con plan activos"
            value={compact(s.activity?.planActiveUsers7d)}
            note={`${compact(s.activity?.planResponses7d)} respuestas realizadas`}
            tone="success"
          />
          <AdminSummaryKpi
            icon={<FiArrowUpCircle />}
            label="Usuarios que hicieron upgrade"
            value={compact(s.upgrades?.totalUpgradeUsers)}
            note={`${compact(s.upgrades?.upgradeUsers7d)} en los últimos 7 días`}
            tone="gold"
          />
        </div>
      </section>

      <section className="admin-overview-split">
        <div className="admin-overview-panel admin-level-panel">
          <div className="admin-section-heading compact-heading">
            <div>
              <span>Distribución</span>
              <h2>Miembros por nivel activo</h2>
            </div>
            <small>{compact(s.users?.total_users)} usuarios registrados</small>
          </div>

          <div className="admin-level-bars admin-level-bars-large">
            {levels.length ? levels.map((level) => {
              const activeUsers = Number(level.activeUsers || 0);
              const width = activeUsers > 0 ? Math.max(2, Math.min(100, (activeUsers / maxLevelUsers) * 100)) : 0;
              return (
                <div className={`admin-level-row ${activeUsers === 0 ? "is-empty" : ""}`} key={level.level}>
                  <div className="admin-level-row-head">
                    <strong>{level.level === 0 ? "Pasantía" : `R${level.level}`}</strong>
                    <span>{compact(activeUsers)} usuarios</span>
                  </div>
                  <div className="admin-level-track" aria-label={`${activeUsers} usuarios en ${level.name}`}>
                    {activeUsers > 0 && <i style={{ width: `${width}%` }} />}
                  </div>
                  <small>{level.name}</small>
                </div>
              );
            }) : <p className="admin-empty-message">No hay información de niveles disponible.</p>}
          </div>
        </div>

        <div className="admin-overview-panel admin-operational-panel">
          <div className="admin-section-heading compact-heading">
            <div>
              <span>Estado operativo</span>
              <h2>Control rápido</h2>
            </div>
            <small>Indicadores que necesitan supervisión</small>
          </div>

          <div className="admin-operational-grid">
            <div>
              <FiShield />
              <strong>{compact(s.users?.suspicious_users)}</strong>
              <span>Usuarios sospechosos</span>
            </div>
            <div>
              <FiAlertTriangle />
              <strong>{compact(s.users?.banned_users)}</strong>
              <span>Usuarios baneados</span>
            </div>
            <div>
              <FiDatabase />
              <strong>{compact(s.deposits?.pendingCollection)}</strong>
              <span>Recargas por recolectar</span>
            </div>
            <div>
              <FiDollarSign />
              <strong>{compact(s.withdrawals?.pendingWithdrawals)}</strong>
              <span>Retiros pendientes</span>
            </div>
            <div>
              <FiCheckCircle />
              <strong>{compact(s.tasks?.activeQuestions)}</strong>
              <span>Preguntas IA activas</span>
            </div>
            <div>
              <FiActivity />
              <strong>{Number(s.activity?.accuracy7d || 0).toFixed(2)}%</strong>
              <span>Precisión últimos 7 días</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function UsersPanel() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 20 });
  const [filters, setFilters] = useState({ search: "", status: "all", level: "" });
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20, search: filters.search, status: filters.status, level: filters.level });
      const res = await api.get(`/admin/users?${params.toString()}`);
      setRows(res.data.users || []);
      setPagination(res.data.pagination || { page, total: 0, limit: 20 });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(1).catch(() => {}); }, [load]);

  const openDetail = async (userId) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/users/${userId}`);
      setDetail(res.data);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetailAndList = async () => {
    const userId = detail?.user?.id;
    if (userId) {
      const res = await api.get(`/admin/users/${userId}`);
      setDetail(res.data);
    }
    await load(pagination.page);
  };

  const levelName = (level) => Number(level || 0) > 0 ? `R${Number(level)}` : "Pasantía";

  return (
    <div className="admin-users-page">
      <section className="admin-users-toolbar">
        <div className="admin-section-heading admin-users-heading">
          <div>
            <span>Gestión de cuentas</span>
            <h2>Usuarios</h2>
          </div>
          <small>{compact(pagination.total)} usuarios encontrados</small>
        </div>

        <div className="admin-users-filters">
          <label className="admin-users-search">
            <span>Buscar por correo o ID</span>
            <div><FiSearch /><input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") load(1); }} placeholder="correo@dominio.com o ID" /></div>
          </label>
          <label><span>Estado</span><select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}><option value="all">Todos</option><option value="normal">Normal</option><option value="admin">Administrador</option><option value="suspicious">Sospechoso</option><option value="banned">Baneado</option></select></label>
          <label><span>Nivel</span><select value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}><option value="">Todos</option>{Array.from({ length: 9 }).map((_, i) => <option key={i} value={i}>{i === 0 ? "Pasantía" : `R${i}`}</option>)}</select></label>
          <button className="admin-users-search-button" type="button" onClick={() => load(1)} disabled={loading}><FiSearch /> {loading ? "Buscando" : "Buscar"}</button>
        </div>
      </section>

      <section className="admin-users-list-panel">
        <div className="admin-users-desktop-table">
          <table className="admin-users-table">
            <thead><tr><th>#</th><th>ID</th><th>Correo</th><th>Nivel</th><th>Saldo retirable</th><th>Invitados</th><th>Estado</th><th>Opciones</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((row, index) => (
                <tr key={row.id}>
                  <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                  <td><strong>#{row.id}</strong></td>
                  <td><button type="button" className="admin-user-email-link" onClick={() => openDetail(row.id)}>{row.email}</button></td>
                  <td><span className={`admin-level-pill level-${Number(row.active_level || 0)}`}>{levelName(row.active_level)}</span></td>
                  <td><strong>{money(row.withdrawable_usdt)}</strong></td>
                  <td>{compact(row.direct_count)}</td>
                  <td><div className="admin-user-statuses">{row.is_admin && <StatusBadge>Admin</StatusBadge>}{row.is_suspicious && <StatusBadge tone="warning">Sospechoso</StatusBadge>}{row.is_banned && <StatusBadge tone="danger">Baneado</StatusBadge>}{!row.is_admin && !row.is_suspicious && !row.is_banned && <StatusBadge tone="success">Normal</StatusBadge>}</div></td>
                  <td><button className="admin-edit-user-button" type="button" onClick={() => openDetail(row.id)}><FiEdit3 /> Editar</button></td>
                </tr>
              )) : <tr><td colSpan="8" className="empty-cell">No se encontraron usuarios.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="admin-users-mobile-list">
          {rows.map((row, index) => (
            <article key={row.id} className="admin-user-mobile-card">
              <div className="admin-user-mobile-top"><span>#{(pagination.page - 1) * pagination.limit + index + 1}</span><strong>ID {row.id}</strong><span className={`admin-level-pill level-${Number(row.active_level || 0)}`}>{levelName(row.active_level)}</span></div>
              <button type="button" className="admin-user-mobile-email" onClick={() => openDetail(row.id)}>{row.email}</button>
              <div className="admin-user-mobile-data"><div><small>Retirable</small><strong>{money(row.withdrawable_usdt)}</strong></div><div><small>Invitados</small><strong>{compact(row.direct_count)}</strong></div></div>
              <div className="admin-user-mobile-bottom"><div className="admin-user-statuses">{row.is_suspicious && <StatusBadge tone="warning">Sospechoso</StatusBadge>}{row.is_banned && <StatusBadge tone="danger">Baneado</StatusBadge>}{!row.is_suspicious && !row.is_banned && <StatusBadge tone="success">Normal</StatusBadge>}</div><button type="button" onClick={() => openDetail(row.id)}><FiEdit3 /> Editar</button></div>
            </article>
          ))}
          {!rows.length && <div className="admin-users-empty">No se encontraron usuarios.</div>}
        </div>

        <PaginationControls page={pagination.page} total={pagination.total} limit={pagination.limit} onPageChange={load} loading={loading} />
      </section>

      {detailLoading && <div className="admin-detail-loading"><FiRefreshCw className="is-spinning" /> Cargando usuario...</div>}
      {detail && <UserDetailModal detail={detail} onClose={() => setDetail(null)} onChanged={refreshDetailAndList} />}
    </div>
  );
}

function UserDetailModal({ detail, onClose, onChanged }) {
  const u = detail.user || {};
  const [section, setSection] = useState("account");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: "", phoneCountryIso: "", phoneCountryName: "", phoneCountryCode: "", phoneNumber: "" });
  const [withdrawForm, setWithdrawForm] = useState({ withdrawEnabled: false, withdrawEnabledNote: "" });
  const [accountForm, setAccountForm] = useState({ id: null, network: "BEP20-USDT", label: "", withdrawalAddress: "", isDefault: false });
  const [balanceForm, setBalanceForm] = useState({ balanceType: "withdrawable", direction: "credit", amountUsdt: "", reason: "" });
  const [rouletteForm, setRouletteForm] = useState({ operation: "add", points: "", reason: "" });
  const [creditForm, setCreditForm] = useState({ operation: "add", points: "", reason: "" });
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
  const [securityForm, setSecurityForm] = useState({ suspiciousReason: u.suspicious_reason || "", bannedReason: u.banned_reason || "" });
  const [activityType, setActivityType] = useState("ledger");
  const [activity, setActivity] = useState({ rows: [], pagination: { page: 1, total: 0, limit: 10 } });
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    setProfileForm({ fullName: u.full_name || "", phoneCountryIso: u.phone_country_iso || "", phoneCountryName: u.phone_country_name || "", phoneCountryCode: u.phone_country_code || "", phoneNumber: u.phone_number || "" });
    setWithdrawForm({ withdrawEnabled: Boolean(u.withdraw_enabled), withdrawEnabledNote: u.withdraw_enabled_note || "" });
    setSecurityForm({ suspiciousReason: u.suspicious_reason || "", bannedReason: u.banned_reason || "" });
  }, [u.id, u.full_name, u.phone_country_iso, u.phone_country_name, u.phone_country_code, u.phone_number, u.withdraw_enabled, u.withdraw_enabled_note, u.suspicious_reason, u.banned_reason]);

  const showResult = (okMessage = "") => {
    setError("");
    setMessage(okMessage);
    window.setTimeout(() => setMessage(""), 2600);
  };
  const handleError = (err, fallback) => {
    setMessage("");
    setError(err?.message || fallback);
  };
  const runAction = async (action, okMessage) => {
    setBusy(true); setError(""); setMessage("");
    try { await action(); showResult(okMessage); if (onChanged) await onChanged(); }
    catch (err) { handleError(err, "No se pudo completar la acción."); }
    finally { setBusy(false); }
  };

  const copyValue = async (value) => {
    try { await navigator.clipboard.writeText(value); showResult("Dirección copiada."); }
    catch (_) { setError("No se pudo copiar automáticamente."); }
  };

  const loadActivity = useCallback(async (type = activityType, page = 1) => {
    setActivityLoading(true);
    try {
      const res = await api.get(`/admin/users/${u.id}/activity?type=${type}&page=${page}&limit=10`);
      setActivity(res.data || { rows: [], pagination: { page, total: 0, limit: 10 } });
    } catch (err) {
      handleError(err, "No se pudo cargar el historial.");
    } finally { setActivityLoading(false); }
  }, [u.id, activityType]);

  useEffect(() => { if (section === "activity") loadActivity(activityType, 1); }, [section, activityType, loadActivity]);

  const saveProfile = (e) => { e.preventDefault(); runAction(() => api.patch(`/admin/users/${u.id}/profile`, profileForm), "Datos personales guardados."); };
  const saveWithdraw = (e) => { e.preventDefault(); runAction(() => api.patch(`/admin/users/${u.id}`, withdrawForm), withdrawForm.withdrawEnabled ? "Retiros habilitados." : "Retiros deshabilitados."); };
  const saveWithdrawalAccount = (e) => {
    e.preventDefault();
    const url = accountForm.id ? `/admin/users/${u.id}/withdrawal-accounts/${accountForm.id}` : `/admin/users/${u.id}/withdrawal-accounts`;
    const method = accountForm.id ? "patch" : "post";
    runAction(() => api[method](url, accountForm), accountForm.id ? "Cuenta de retiro actualizada." : "Cuenta de retiro añadida.").then(() => setAccountForm({ id: null, network: "BEP20-USDT", label: "", withdrawalAddress: "", isDefault: false }));
  };
  const editWithdrawalAccount = (account) => { setAccountForm({ id: account.id, network: account.network, label: account.label || "", withdrawalAddress: account.withdrawal_address || "", isDefault: Boolean(account.is_default) }); };
  const deleteWithdrawalAccount = (account) => {
    if (!window.confirm(`¿Eliminar la cuenta ${account.network}?`)) return;
    runAction(() => api.delete(`/admin/users/${u.id}/withdrawal-accounts/${account.id}`), "Cuenta eliminada.");
  };
  const submitBalance = (e) => { e.preventDefault(); runAction(() => api.post(`/admin/users/${u.id}/balance`, balanceForm), "Saldo actualizado.").then(() => setBalanceForm((f) => ({ ...f, amountUsdt: "", reason: "" }))); };
  const submitRoulette = (e) => { e.preventDefault(); runAction(() => api.post(`/admin/users/${u.id}/roulette-points`, rouletteForm), "Giros actualizados.").then(() => setRouletteForm((f) => ({ ...f, points: "", reason: "" }))); };
  const submitCredit = (e) => { e.preventDefault(); runAction(() => api.post(`/admin/users/${u.id}/credit-points`, creditForm), "Puntos de crédito actualizados.").then(() => setCreditForm((f) => ({ ...f, points: "", reason: "" }))); };
  const resetPassword = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setError("Las contraseñas no coinciden."); return; }
    runAction(() => api.post(`/admin/users/${u.id}/reset-password`, { newPassword: passwordForm.newPassword }), "Contraseña cambiada y sesiones cerradas.").then(() => setPasswordForm({ newPassword: "", confirmPassword: "" }));
  };
  const forceLogout = () => { if (window.confirm("¿Cerrar todas las sesiones activas de este usuario?")) runAction(() => api.post(`/admin/users/${u.id}/force-logout`), "Sesiones cerradas."); };
  const toggleSuspicious = () => runAction(() => api.patch(`/admin/users/${u.id}`, { isSuspicious: !u.is_suspicious, suspiciousReason: !u.is_suspicious ? securityForm.suspiciousReason || "Marcado para revisión por administrador." : "" }), u.is_suspicious ? "Alerta retirada." : "Usuario marcado como sospechoso.");
  const toggleBan = () => { if (!u.is_banned && !window.confirm("¿Banear esta cuenta? El usuario perderá acceso inmediatamente.")) return; runAction(() => api.patch(`/admin/users/${u.id}`, { isBanned: !u.is_banned, bannedReason: !u.is_banned ? securityForm.bannedReason || "Cuenta bloqueada por administrador." : "" }), u.is_banned ? "Usuario desbaneado." : "Usuario baneado."); };

  const accountSections = [
    { key: "account", label: "Cuenta", icon: <FiUser /> },
    { key: "wallets", label: "Wallets", icon: <FiCreditCard /> },
    { key: "adjustments", label: "Ajustes", icon: <FiSliders /> },
    { key: "referrals", label: "Invitados", icon: <FiUsers /> },
    { key: "activity", label: "Actividad", icon: <FiActivity /> },
    { key: "security", label: "Seguridad", icon: <FiShield /> },
  ];
  const levelText = Number(u.active_level || 0) > 0 ? `R${u.active_level}` : "Pasantía";
  const personalComplete = Boolean(u.full_name && u.phone_country_code && u.phone_number);

  const renderActivityRows = () => {
    if (!activity.rows?.length) return <div className="admin-user-empty-state">No hay movimientos para mostrar.</div>;
    if (activityType === "tasks") return <div className="admin-user-simple-list">{activity.rows.map((r) => <div key={r.id}><div><strong>{r.title}</strong><small>{shortDate(r.created_at)} · {r.asset || r.category}</small></div><div><StatusBadge tone={r.is_correct ? "success" : "warning"}>{r.is_correct ? "Correcta" : "Incorrecta"}</StatusBadge><strong>{money(r.reward_usdt)}</strong></div></div>)}</div>;
    if (activityType === "deposits") return <div className="admin-user-simple-list">{activity.rows.map((r) => <div key={r.id}><div><strong>Recarga {r.network}</strong><small>{shortDate(r.created_at)} · {r.tx_hash ? shortAddress(r.tx_hash) : "Sin hash"}</small></div><div><StatusBadge tone={r.status === "confirmed" ? "success" : "warning"}>{r.status}</StatusBadge><strong>{money(r.amount_usdt)}</strong></div></div>)}</div>;
    if (activityType === "withdrawals") return <div className="admin-user-simple-list">{activity.rows.map((r) => <div key={r.id}><div><strong>Retiro {r.network}</strong><small>{shortDate(r.created_at)} · Recibe {money(r.amount_to_receive)}</small></div><div><StatusBadge tone={r.status === "paid" ? "success" : r.status === "rejected" ? "danger" : "warning"}>{r.status}</StatusBadge><strong>{money(r.amount_requested)}</strong></div></div>)}</div>;
    return <div className="admin-user-simple-list">{activity.rows.map((r) => <div key={r.id}><div><strong>{r.title || r.type}</strong><small>{shortDate(r.created_at)} · {r.balance_type}</small></div><div><StatusBadge tone={r.direction === "credit" ? "success" : "warning"}>{r.direction === "credit" ? "Ingreso" : "Salida"}</StatusBadge><strong>{r.direction === "debit" ? "−" : "+"}{money(r.amount_usdt)}</strong></div></div>)}</div>;
  };

  return (
    <div className="admin-user-editor-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="admin-user-editor" aria-label={`Editar usuario ${u.email}`}>
        <header className="admin-user-editor-header">
          <div><span>Editar usuario · ID {u.id}</span><h2>{u.email}</h2><div className="admin-user-editor-badges"><span className={`admin-level-pill level-${Number(u.active_level || 0)}`}>{levelText}</span>{u.is_suspicious && <StatusBadge tone="warning">Sospechoso</StatusBadge>}{u.is_banned && <StatusBadge tone="danger">Baneado</StatusBadge>}{!u.is_suspicious && !u.is_banned && <StatusBadge tone="success">Activo</StatusBadge>}</div></div>
          <button type="button" className="admin-user-editor-close" onClick={onClose} aria-label="Cerrar"><FiX /></button>
        </header>

        {(message || error) && <div className={`admin-user-editor-alert ${error ? "error" : "success"}`}>{error || message}</div>}

        <div className="admin-user-editor-kpis">
          <div><span>Saldo retirable</span><strong>{money(u.withdrawable_usdt)}</strong></div>
          <div><span>Saldo garantía</span><strong>{money(u.recharge_balance_usdt)}</strong></div>
          <div><span>Ruletas</span><strong>{compact(u.roulette_points)}</strong></div>
          <div><span>Puntos crédito</span><strong>{compact(u.credit_points)}</strong></div>
        </div>

        <nav className="admin-user-editor-tabs">{accountSections.map((item) => <button key={item.key} type="button" className={section === item.key ? "active" : ""} onClick={() => setSection(item.key)}>{item.icon}<span>{item.label}</span></button>)}</nav>

        <div className="admin-user-editor-content">
          {section === "account" && <div className="admin-user-editor-grid">
            <form className="admin-user-flat-section" onSubmit={saveProfile}>
              <div className="admin-user-section-title"><div><span>Datos personales</span><h3>Información de contacto</h3></div><StatusBadge tone={personalComplete ? "success" : "warning"}>{personalComplete ? "Completado" : "Incompleto"}</StatusBadge></div>
              <div className="admin-user-form-grid"><label className="wide"><span>Nombre completo</span><input value={profileForm.fullName} onChange={(e) => setProfileForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Nombre y apellidos" /></label><label><span>ISO país</span><input value={profileForm.phoneCountryIso} onChange={(e) => setProfileForm((f) => ({ ...f, phoneCountryIso: e.target.value.toUpperCase() }))} placeholder="PE" /></label><label><span>País</span><input value={profileForm.phoneCountryName} onChange={(e) => setProfileForm((f) => ({ ...f, phoneCountryName: e.target.value }))} placeholder="Perú" /></label><label><span>Prefijo</span><input value={profileForm.phoneCountryCode} onChange={(e) => setProfileForm((f) => ({ ...f, phoneCountryCode: e.target.value }))} placeholder="+51" /></label><label><span>Celular</span><input value={profileForm.phoneNumber} onChange={(e) => setProfileForm((f) => ({ ...f, phoneNumber: e.target.value }))} placeholder="999999999" /></label></div>
              <button className="admin-user-primary-action" type="submit" disabled={busy}><FiSave /> Guardar datos</button>
            </form>

            <form className="admin-user-flat-section" onSubmit={saveWithdraw}>
              <div className="admin-user-section-title"><div><span>Retiros</span><h3>Validación de cuenta</h3></div><StatusBadge tone={u.withdraw_enabled ? "success" : "warning"}>{u.withdraw_enabled ? "Habilitado" : "Deshabilitado"}</StatusBadge></div>
              <label className="admin-user-switch-row"><input type="checkbox" checked={withdrawForm.withdrawEnabled} onChange={(e) => setWithdrawForm((f) => ({ ...f, withdrawEnabled: e.target.checked }))} /><span><strong>Permitir retiros</strong><small>El usuario podrá solicitar retiros si cumple el resto de condiciones.</small></span></label>
              <label><span>Nota interna</span><textarea value={withdrawForm.withdrawEnabledNote} onChange={(e) => setWithdrawForm((f) => ({ ...f, withdrawEnabledNote: e.target.value }))} rows="3" placeholder="Validación, observaciones o motivo" /></label>
              <button className="admin-user-primary-action" type="submit" disabled={busy}><FiSave /> Guardar estado</button>
            </form>

            <div className="admin-user-flat-section admin-user-account-data">
              <div className="admin-user-section-title"><div><span>Cuenta</span><h3>Información general</h3></div></div>
              <dl><div><dt>Registro</dt><dd>{shortDate(u.created_at)}</dd></div><div><dt>Plan activo</dt><dd>{levelText}</dd></div><div><dt>Compra del plan</dt><dd>{shortDate(u.plan_purchased_at)}</dd></div><div><dt>Último acceso</dt><dd>{shortDate(u.last_login_at)}</dd></div><div><dt>Código referido</dt><dd>{u.referral_code || "—"}</dd></div></dl>
            </div>
          </div>}

          {section === "wallets" && <div className="admin-user-editor-grid">
            <div className="admin-user-flat-section">
              <div className="admin-user-section-title"><div><span>Wallets de carga</span><h3>Direcciones asignadas</h3></div></div>
              <div className="admin-wallet-clean-list">{(detail.depositWallets || []).map((wallet) => <div key={wallet.id}><div><strong>{wallet.network}</strong><code>{wallet.address}</code></div><div><button type="button" onClick={() => copyValue(wallet.address)}><FiCopy /> Copiar</button>{scanUrl(wallet.network, wallet.address) && <a href={scanUrl(wallet.network, wallet.address)} target="_blank" rel="noreferrer"><FiExternalLink /> Scan</a>}</div></div>)}{!(detail.depositWallets || []).length && <div className="admin-user-empty-state">Sin wallets de carga asignadas.</div>}</div>
            </div>

            <form className="admin-user-flat-section" onSubmit={saveWithdrawalAccount}>
              <div className="admin-user-section-title"><div><span>Cuenta de retiro</span><h3>{accountForm.id ? "Editar wallet" : "Añadir wallet"}</h3></div>{accountForm.id && <button type="button" className="admin-user-text-action" onClick={() => setAccountForm({ id: null, network: "BEP20-USDT", label: "", withdrawalAddress: "", isDefault: false })}>Cancelar edición</button>}</div>
              <div className="admin-user-form-grid"><label><span>Red</span><select value={accountForm.network} onChange={(e) => setAccountForm((f) => ({ ...f, network: e.target.value }))}><option value="BEP20-USDT">BEP20-USDT</option><option value="POLYGON-USDT">POLYGON-USDT</option></select></label><label><span>Etiqueta</span><input value={accountForm.label} onChange={(e) => setAccountForm((f) => ({ ...f, label: e.target.value }))} placeholder="Cuenta principal" /></label><label className="wide"><span>Dirección</span><input value={accountForm.withdrawalAddress} onChange={(e) => setAccountForm((f) => ({ ...f, withdrawalAddress: e.target.value.trim() }))} placeholder="0x..." required /></label></div>
              <label className="admin-user-switch-row compact"><input type="checkbox" checked={accountForm.isDefault} onChange={(e) => setAccountForm((f) => ({ ...f, isDefault: e.target.checked }))} /><span><strong>Cuenta predeterminada</strong></span></label>
              <button className="admin-user-primary-action" type="submit" disabled={busy}><FiPlus /> {accountForm.id ? "Actualizar cuenta" : "Añadir cuenta"}</button>
            </form>

            <div className="admin-user-flat-section wide-section">
              <div className="admin-user-section-title"><div><span>Cuentas registradas</span><h3>Wallets de retiro</h3></div><small>{compact(detail.withdrawalAccounts?.length)} cuentas</small></div>
              <div className="admin-withdraw-account-clean-list">{(detail.withdrawalAccounts || []).map((account) => <div key={account.id}><div><strong>{account.label || account.network}</strong><span>{account.network}{account.is_default ? " · Predeterminada" : ""}</span><code>{account.withdrawal_address}</code></div><div><button type="button" onClick={() => editWithdrawalAccount(account)}><FiEdit3 /> Editar</button><button type="button" className="danger" onClick={() => deleteWithdrawalAccount(account)}><FiTrash2 /> Borrar</button></div></div>)}{!(detail.withdrawalAccounts || []).length && <div className="admin-user-empty-state">El usuario todavía no tiene cuentas de retiro.</div>}</div>
            </div>
          </div>}

          {section === "adjustments" && <div className="admin-user-adjustment-grid">
            <form className="admin-user-flat-section" onSubmit={submitBalance}><div className="admin-user-section-title"><div><span>Saldos</span><h3>Aumentar o disminuir</h3></div></div><div className="admin-user-form-grid"><label><span>Saldo</span><select value={balanceForm.balanceType} onChange={(e) => setBalanceForm((f) => ({ ...f, balanceType: e.target.value }))}><option value="withdrawable">Saldo retirable</option><option value="recharge">Saldo garantía</option></select></label><label><span>Operación</span><select value={balanceForm.direction} onChange={(e) => setBalanceForm((f) => ({ ...f, direction: e.target.value }))}><option value="credit">Aumentar</option><option value="debit">Disminuir</option></select></label><label><span>Monto USDT</span><input type="number" min="0.000001" step="0.000001" value={balanceForm.amountUsdt} onChange={(e) => setBalanceForm((f) => ({ ...f, amountUsdt: e.target.value }))} required /></label><label className="wide"><span>Motivo</span><input value={balanceForm.reason} onChange={(e) => setBalanceForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Motivo del ajuste" /></label></div><button className="admin-user-primary-action" type="submit" disabled={busy}><FiSave /> Aplicar saldo</button></form>
            <form className="admin-user-flat-section" onSubmit={submitRoulette}><div className="admin-user-section-title"><div><span>Ruleta</span><h3>Ajustar giros</h3></div></div><div className="admin-user-form-grid"><label><span>Operación</span><select value={rouletteForm.operation} onChange={(e) => setRouletteForm((f) => ({ ...f, operation: e.target.value }))}><option value="add">Aumentar</option><option value="subtract">Disminuir</option><option value="set">Fijar total</option></select></label><label><span>Cantidad</span><input type="number" min="0" step="1" value={rouletteForm.points} onChange={(e) => setRouletteForm((f) => ({ ...f, points: e.target.value }))} required /></label><label className="wide"><span>Motivo</span><input value={rouletteForm.reason} onChange={(e) => setRouletteForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Bono, corrección, evento..." /></label></div><button className="admin-user-primary-action" type="submit" disabled={busy}><FiSave /> Aplicar giros</button></form>
            <form className="admin-user-flat-section" onSubmit={submitCredit}><div className="admin-user-section-title"><div><span>Crédito</span><h3>Ajustar puntos</h3></div></div><div className="admin-user-form-grid"><label><span>Operación</span><select value={creditForm.operation} onChange={(e) => setCreditForm((f) => ({ ...f, operation: e.target.value }))}><option value="add">Aumentar</option><option value="subtract">Disminuir</option><option value="set">Fijar total</option></select></label><label><span>Cantidad</span><input type="number" min="0" step="1" value={creditForm.points} onChange={(e) => setCreditForm((f) => ({ ...f, points: e.target.value }))} required /></label><label className="wide"><span>Motivo</span><input value={creditForm.reason} onChange={(e) => setCreditForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Motivo obligatorio" required /></label></div><button className="admin-user-primary-action" type="submit" disabled={busy}><FiSave /> Aplicar puntos</button></form>
          </div>}

          {section === "referrals" && <div className="admin-user-flat-section">
            <div className="admin-user-section-title"><div><span>Equipo directo</span><h3>Invitados del usuario</h3></div><small>{compact(detail.referrals?.length)} encontrados</small></div>
            <div className="admin-referrals-clean-table"><div className="head"><span>ID</span><span>Correo</span><span>Nivel</span><span>Creación</span><span>Compra de plan</span></div>{(detail.referrals || []).map((r) => <div className="row" key={r.id}><strong>#{r.id}</strong><span>{r.email}</span><span className={`admin-level-pill level-${Number(r.active_level || 0)}`}>{Number(r.active_level || 0) ? `R${r.active_level}` : "Pasantía"}</span><span>{shortDate(r.created_at)}</span><span>{shortDate(r.plan_purchased_at)}</span></div>)}{!(detail.referrals || []).length && <div className="admin-user-empty-state">Este usuario no tiene invitados directos.</div>}</div>
          </div>}

          {section === "activity" && <div className="admin-user-flat-section">
            <div className="admin-user-section-title"><div><span>Historial paginado</span><h3>Actividad de la cuenta</h3></div><small>{compact(activity.pagination?.total)} registros</small></div>
            <div className="admin-activity-tabs"><button type="button" className={activityType === "ledger" ? "active" : ""} onClick={() => setActivityType("ledger")}>Ganancias y saldos</button><button type="button" className={activityType === "tasks" ? "active" : ""} onClick={() => setActivityType("tasks")}>Tareas</button><button type="button" className={activityType === "deposits" ? "active" : ""} onClick={() => setActivityType("deposits")}>Recargas</button><button type="button" className={activityType === "withdrawals" ? "active" : ""} onClick={() => setActivityType("withdrawals")}>Retiros</button></div>
            {activityLoading ? <div className="admin-user-empty-state"><FiRefreshCw className="is-spinning" /> Cargando historial...</div> : renderActivityRows()}
            <PaginationControls page={activity.pagination?.page || 1} total={activity.pagination?.total || 0} limit={activity.pagination?.limit || 10} onPageChange={(page) => loadActivity(activityType, page)} loading={activityLoading} />
          </div>}

          {section === "security" && <div className="admin-user-editor-grid">
            <div className="admin-user-flat-section">
              <div className="admin-user-section-title"><div><span>Acceso</span><h3>Contraseña y sesiones</h3></div></div>
              <form className="admin-password-reset-form" onSubmit={resetPassword}><label><span>Nueva contraseña</span><input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))} placeholder="Mín. 8, mayúscula, minúscula y número" required /></label><label><span>Confirmar contraseña</span><input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))} required /></label><button type="submit" disabled={busy}><FiKey /> Cambiar contraseña</button></form>
              <button type="button" className="admin-force-logout-button" onClick={forceLogout} disabled={busy}><FiLogOut /> Cerrar todas sus sesiones</button>
            </div>

            <div className="admin-user-flat-section">
              <div className="admin-user-section-title"><div><span>Moderación</span><h3>Estado de seguridad</h3></div></div>
              <label><span>Motivo de sospecha</span><textarea rows="3" value={securityForm.suspiciousReason} onChange={(e) => setSecurityForm((f) => ({ ...f, suspiciousReason: e.target.value }))} placeholder="Motivo interno" /></label>
              <button type="button" className={`admin-security-action ${u.is_suspicious ? "neutral" : "warning"}`} onClick={toggleSuspicious} disabled={busy}><FiAlertTriangle /> {u.is_suspicious ? "Quitar estado sospechoso" : "Marcar como sospechoso"}</button>
              <label><span>Motivo de baneo</span><textarea rows="3" value={securityForm.bannedReason} onChange={(e) => setSecurityForm((f) => ({ ...f, bannedReason: e.target.value }))} placeholder="Motivo del bloqueo" /></label>
              <button type="button" className={`admin-security-action ${u.is_banned ? "neutral" : "danger"}`} onClick={toggleBan} disabled={busy}><FiShield /> {u.is_banned ? "Desbanear usuario" : "Banear usuario"}</button>
            </div>

            <div className="admin-user-flat-section wide-section">
              <div className="admin-user-section-title"><div><span>Direcciones IP</span><h3>Cuentas relacionadas</h3></div><small>{compact(detail.sharedIpUsers?.length)} coincidencias</small></div>
              <div className="admin-ip-summary"><div><span>IP de registro</span><code>{u.register_ip || "No registrada"}</code></div><div><span>Última IP</span><code>{u.last_login_ip || "No registrada"}</code></div></div>
              <div className="admin-shared-ip-list">{(detail.sharedIpUsers || []).map((r) => <div key={r.id}><strong>#{r.id}</strong><span>{r.email}</span><span className={`admin-level-pill level-${Number(r.active_level || 0)}`}>{Number(r.active_level || 0) ? `R${r.active_level}` : "Pasantía"}</span><code>{r.matching_ip || "—"}</code></div>)}{!(detail.sharedIpUsers || []).length && <div className="admin-user-empty-state">No se detectaron otras cuentas con las mismas IP.</div>}</div>
            </div>
          </div>}
        </div>
      </section>
    </div>
  );
}


function TasksAdminPanel() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: ADMIN_PAGE_SIZE });
  const [filters, setFilters] = useState({ search: "", category: "all", level: "", active: "all" });
  const [form, setForm] = useState({ levelMin: 0, category: "trend", asset: "BTC", chartType: "uptrend", title: "", question: "", optionA: "", optionB: "", optionC: "", correctOption: "A" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: ADMIN_PAGE_SIZE, search: filters.search, category: filters.category, level: filters.level, active: filters.active });
      const res = await api.get(`/admin/tasks?${params.toString()}`);
      setRows(res.data.questions || []);
      setPagination(res.data.pagination || { page, total: 0, limit: ADMIN_PAGE_SIZE });
    } finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { load(1).catch(() => {}); }, [load]);

  const createTask = async (e) => {
    e.preventDefault();
    setMessage("");
    await api.post("/admin/tasks", form);
    setMessage("Tarea creada correctamente.");
    setForm((f) => ({ ...f, title: "", question: "", optionA: "", optionB: "", optionC: "" }));
    await load(1);
  };
  const toggleTask = async (q) => {
    await api.patch(`/admin/tasks/${q.id}`, { isActive: !q.isActive });
    await load(pagination.page);
  };

  return (
    <div className="page-stack">
      {message && <div className="alert success">{message}</div>}
      <div className="two-columns admin-two wide-left">
        <div className="panel-card">
          <div className="section-title"><span>Banco de tareas</span><h3>Preguntas IA</h3></div>
          <div className="admin-filters compact-filters">
            <input value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Buscar por título, activo o pregunta" />
            <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}><option value="all">Todas las categorías</option><option value="trend">Tendencia</option><option value="volatility">Volatilidad</option><option value="news">Noticias</option><option value="signal">Señal IA</option><option value="risk">Riesgo</option><option value="comparison">Comparación</option></select>
            <select value={filters.active} onChange={(e) => setFilters((f) => ({ ...f, active: e.target.value }))}><option value="all">Todas</option><option value="true">Activas</option><option value="false">Inactivas</option></select>
            <button className="secondary-btn" type="button" disabled={loading} onClick={() => load(1)}><FiSearch /> Filtrar</button>
          </div>
          <AdminTable rows={rows} columns={[{ key: "id", label: "ID" }, { key: "title", label: "Tarea" }, { key: "asset", label: "Activo" }, { key: "levelMin", label: "Nivel" }, { key: "accuracyPercent", label: "Precisión" , render: (r) => `${r.accuracyPercent}%`}, { key: "responseCount", label: "Respuestas" }, { key: "isActive", label: "Estado", render: (r) => <StatusBadge tone={r.isActive ? "success" : "danger"}>{r.isActive ? "Activa" : "Inactiva"}</StatusBadge> }, { key: "actions", label: "Acción", render: (r) => <button className="table-action-btn" onClick={() => toggleTask(r)}>{r.isActive ? "Desactivar" : "Activar"}</button> }]} />
          <PaginationControls page={pagination.page} total={pagination.total} limit={pagination.limit} loading={loading} onPageChange={load} />
        </div>
        <div className="panel-card">
          <div className="section-title"><span>Nueva tarea</span><h3>Crear pregunta</h3></div>
          <form className="form-stack" onSubmit={createTask}>
            <label><span>Nivel mínimo</span><select value={form.levelMin} onChange={(e) => setForm((f) => ({ ...f, levelMin: Number(e.target.value) }))}>{Array.from({ length: 9 }).map((_, i) => <option key={i} value={i}>{i === 0 ? "Nivel 0 · Pasantía" : `Nivel ${i}`}</option>)}</select></label>
            <label><span>Categoría</span><select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}><option value="trend">Tendencia</option><option value="volatility">Volatilidad</option><option value="news">Noticias</option><option value="signal">Señal IA</option><option value="risk">Riesgo</option><option value="comparison">Comparación</option></select></label>
            <label><span>Activo</span><input value={form.asset} onChange={(e) => setForm((f) => ({ ...f, asset: e.target.value.toUpperCase() }))} /></label>
            <label><span>Gráfico CSS/SVG</span><select value={form.chartType} onChange={(e) => setForm((f) => ({ ...f, chartType: e.target.value }))}><option value="">Sin gráfico</option><option value="uptrend">Alcista</option><option value="downtrend">Bajista</option><option value="sideways">Lateral</option><option value="volatile">Volátil</option><option value="recovery">Recuperación</option><option value="breakdown">Ruptura bajista</option></select></label>
            <label><span>Título</span><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label>
            <label><span>Pregunta</span><textarea value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} rows="4" /></label>
            <label><span>Opción A</span><input value={form.optionA} onChange={(e) => setForm((f) => ({ ...f, optionA: e.target.value }))} /></label>
            <label><span>Opción B</span><input value={form.optionB} onChange={(e) => setForm((f) => ({ ...f, optionB: e.target.value }))} /></label>
            <label><span>Opción C</span><input value={form.optionC} onChange={(e) => setForm((f) => ({ ...f, optionC: e.target.value }))} /></label>
            <label><span>Correcta interna</span><select value={form.correctOption} onChange={(e) => setForm((f) => ({ ...f, correctOption: e.target.value }))}><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></label>
            <button className="primary-btn full" type="submit">Crear tarea</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function DepositsPanel() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: ADMIN_PAGE_SIZE });
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/deposits?page=${page}&limit=${ADMIN_PAGE_SIZE}`);
      setRows(res.data.deposits || []);
      setPagination(res.data.pagination || { page, total: 0, limit: ADMIN_PAGE_SIZE });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(1).catch(() => {}); }, [load]);
  const runAction = async (id, action) => { await api.post(`/admin/deposits/${id}/${action}`); await load(pagination.page); };
  const total = rows.reduce((sum, r) => sum + Number(r.amount_usdt || 0), 0);
  return <div className="page-stack"><div className="metric-grid admin-metrics"><MetricCard icon={<FiCreditCard />} label="Recargas página" value={compact(rows.length)} /><MetricCard icon={<FiDollarSign />} label="Total página" value={money(total)} /><MetricCard icon={<FiDatabase />} label="Por recolectar" value={compact(rows.filter((r) => r.sweep_status !== "swept").length)} /><MetricCard icon={<FiRefreshCw />} label="Actualización" value={loading ? "Cargando" : "Lista"} /></div><div className="panel-card"><div className="section-title"><span>Recargas</span><h3>Depósitos confirmados</h3></div><AdminTable rows={rows} columns={[{ key: "email", label: "Usuario" }, { key: "amount_usdt", label: "Monto", render: (r) => money(r.amount_usdt) }, { key: "network", label: "Red" }, { key: "sweep_status", label: "Recolección", render: (r) => <StatusBadge tone={r.sweep_status === "swept" ? "success" : "warning"}>{r.sweep_status || "pending"}</StatusBadge> }, { key: "created_at", label: "Fecha", render: (r) => shortDate(r.created_at) }, { key: "actions", label: "Acciones", render: (r) => <div className="table-actions"><button disabled={!r.actions?.canSendGas} onClick={() => runAction(r.id, "send-gas")}>Gas</button><button disabled={!r.actions?.canCollect} onClick={() => runAction(r.id, "collect")}>Recolectar</button><button disabled={!r.actions?.canRefresh} onClick={() => runAction(r.id, "refresh")}>Refresh</button></div> }]} /><PaginationControls page={pagination.page} total={pagination.total} limit={pagination.limit} loading={loading} onPageChange={load} /></div></div>;
}

function WithdrawalsPanel() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: ADMIN_PAGE_SIZE });
  const [filter, setFilter] = useState("all");
  const [amountText, setAmountText] = useState("10,30,80,200,500,1000,2000,3000");
  const [configMessage, setConfigMessage] = useState("");

  const loadOptions = useCallback(async () => {
    const res = await api.get("/admin/withdrawal-amount-options");
    const values = (res.data.options || []).map((item) => Number(item.amount_usdt || item.amountUsdt || 0)).filter(Boolean);
    if (values.length) setAmountText(values.join(","));
  }, []);

  const load = useCallback(async (page = 1) => {
    const endpoint = filter === "pending" ? "/admin/withdrawals/pending" : "/admin/withdrawals";
    const res = await api.get(`${endpoint}?page=${page}&limit=${ADMIN_PAGE_SIZE}`);
    setRows(res.data.withdrawals || []);
    setPagination(res.data.pagination || { page, total: 0, limit: ADMIN_PAGE_SIZE });
  }, [filter]);

  useEffect(() => { load(1).catch(() => {}); }, [load]);
  useEffect(() => { loadOptions().catch(() => {}); }, [loadOptions]);

  const approve = async (id) => { await api.post(`/admin/withdrawals/${id}/approve`); await load(pagination.page); };
  const saveOptions = async (e) => {
    e.preventDefault();
    const amounts = amountText.split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0);
    await api.put("/admin/withdrawal-amount-options", { amounts });
    setConfigMessage("Montos de retiro actualizados.");
    await loadOptions();
  };

  return (
    <div className="page-stack">
      {configMessage && <div className="alert success">{configMessage}</div>}
      <div className="two-columns admin-two">
        <div className="admin-filter-card panel-card">
          <div className="section-title"><span>Retiros</span><h3>Solicitudes y pagos</h3></div>
          <div className="admin-filters compact-filters"><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Todos</option><option value="pending">Pendientes</option></select></div>
        </div>
        <form className="panel-card form-stack" onSubmit={saveOptions}>
          <div className="section-title"><span>Configuración</span><h3>Montos disponibles</h3></div>
          <label><span>Montos exactos USDT</span><input value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="10,30,80,200,500,1000,2000,3000" /></label>
          <small className="muted-text">Separados por coma. Estos son los únicos montos que el usuario podrá seleccionar.</small>
          <button className="primary-btn full" type="submit">Guardar montos</button>
        </form>
      </div>
      <div className="panel-card">
        <AdminTable rows={rows} columns={[{ key: "email", label: "Usuario" }, { key: "amount_requested", label: "Solicita", render: (r) => money(r.amount_requested) }, { key: "amount_to_receive", label: "Recibe", render: (r) => money(r.amount_to_receive) }, { key: "network", label: "Red" }, { key: "status", label: "Estado", render: (r) => <StatusBadge tone={r.status === "paid" ? "success" : r.status === "pending" ? "warning" : "neutral"}>{r.status}</StatusBadge> }, { key: "created_at", label: "Fecha", render: (r) => shortDate(r.created_at) }, { key: "actions", label: "Acción", render: (r) => r.status === "pending" ? <button className="table-action-btn" onClick={() => approve(r.id)}>Aprobar</button> : safeText(r.tx_hash, "Procesado") }]} />
        <PaginationControls page={pagination.page} total={pagination.total} limit={pagination.limit} onPageChange={load} />
      </div>
    </div>
  );
}

function LevelsPanel() {
  const [levels, setLevels] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => { const res = await api.get("/admin/levels"); setLevels(res.data.levels || []); }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  const save = async (e) => {
    e.preventDefault();
    await api.patch(`/admin/levels/${editing.level}`, {
      name: editing.name,
      priceUsdt: editing.price_usdt,
      taskRewardUsdt: editing.task_reward_usdt,
      taskCooldownSeconds: editing.task_cooldown_seconds,
      dailyTasks: editing.daily_tasks,
      validDays: editing.valid_days,
      isPurchasable: Boolean(editing.is_purchasable),
    });
    setMessage("Nivel actualizado correctamente.");
    setEditing(null);
    await load();
  };
  return (
    <div className="page-stack">
      {message && <div className="alert success">{message}</div>}
      <div className="levels-grid admin-level-grid">
        {levels.map((l) => {
          const available = Boolean(l.is_purchasable);
          return (
            <div className={`level-card admin-level-card ${available ? "" : "coming-soon"}`} key={l.level}>
              <div className="level-plan-head">
                <img src="/royal-icon.svg" alt="Royal" />
                <div><span>Plan</span><h3>{l.name}</h3></div>
                <b className={available ? "level-state active" : "level-state locked"}>{available ? "Disponible" : "Deshabilitado"}</b>
              </div>
              <strong className="level-price">{money(l.price_usdt)}</strong>
              <ul className="level-benefits">
                <li>{l.daily_tasks} tareas diarias</li>
                <li>{money(l.task_reward_usdt)} por pregunta</li>
                <li>{l.task_cooldown_seconds}s espera</li>
                <li>{l.valid_days} días · {l.active_users} activos</li>
              </ul>
              <button className="secondary-btn compact-level-action" onClick={() => setEditing(l)}><FiEdit3 /> Editar</button>
            </div>
          );
        })}
      </div>
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form className="admin-modal compact-modal" onSubmit={save} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>Editar plan {editing.name}</h3><button type="button" className="icon-btn" onClick={() => setEditing(null)}>×</button></div>
            <label>Nombre del plan<input value={editing.name} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} /></label>
            <label>Precio USDT<input type="number" step="0.01" value={editing.price_usdt} onChange={(e) => setEditing((x) => ({ ...x, price_usdt: e.target.value }))} /></label>
            <label>Recompensa por pregunta<input type="number" step="0.0001" value={editing.task_reward_usdt} onChange={(e) => setEditing((x) => ({ ...x, task_reward_usdt: e.target.value }))} /></label>
            <label>Tareas diarias<input type="number" value={editing.daily_tasks} onChange={(e) => setEditing((x) => ({ ...x, daily_tasks: e.target.value }))} /></label>
            <label>Espera segundos<input type="number" value={editing.task_cooldown_seconds} onChange={(e) => setEditing((x) => ({ ...x, task_cooldown_seconds: e.target.value }))} /></label>
            <label>Días de validez<input type="number" value={editing.valid_days} onChange={(e) => setEditing((x) => ({ ...x, valid_days: e.target.value }))} /></label>
            <label className="toggle-line">
              <input type="checkbox" checked={Boolean(editing.is_purchasable)} disabled={Number(editing.level) === 0} onChange={(e) => setEditing((x) => ({ ...x, is_purchasable: e.target.checked }))} />
              <span>Disponible para adquirir</span>
            </label>
            <small className="muted-text">Si desactivas un plan, el usuario lo verá como “Próximamente” y no podrá comprarlo.</small>
            <button className="primary-btn full" type="submit">Guardar cambios</button>
          </form>
        </div>
      )}
    </div>
  );
}


function imageUrl(src) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:")) return src;
  if (src.startsWith("/")) return src;
  return `/${src}`;
}

function SupportAdminPanel() {
  const emptySupportForm = useMemo(() => ({ type: "whatsapp", label: "", value: "", url: "", description: "", sortOrder: 1, isActive: true }), []);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: ADMIN_PAGE_SIZE });
  const [form, setForm] = useState(emptySupportForm);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const normalizeError = (err, fallback = "No se pudo completar la acción.") =>
    err?.response?.data?.message || err?.response?.data?.detail || err?.message || fallback;

  const load = useCallback(async (page = 1) => {
    setError("");
    try {
      const res = await api.get(`/admin/support-channels?page=${page}&limit=${ADMIN_PAGE_SIZE}`);
      setRows(res.data.channels || []);
      setPagination(res.data.pagination || { page, total: 0, limit: ADMIN_PAGE_SIZE });
    } catch (err) {
      setError(normalizeError(err, "No se pudieron cargar los canales."));
    }
  }, []);

  useEffect(() => { load(1).catch(() => {}); }, [load]);

  const resetForm = () => {
    setEditing(null);
    setForm({ ...emptySupportForm, sortOrder: rows.length + 1 });
  };

  const edit = (row) => {
    setMessage("");
    setError("");
    setEditing(row);
    setForm({
      type: row.type || "whatsapp",
      label: row.label || "",
      value: row.value || "",
      url: row.url || "",
      description: row.description || "",
      sortOrder: Number(row.sortOrder || 0),
      isActive: row.isActive !== false,
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      if (editing?.id) {
        await api.patch(`/admin/support-channels/${editing.id}`, form);
        setMessage("Canal actualizado correctamente.");
        setEditing(null);
        setForm({ ...emptySupportForm, sortOrder: rows.length + 1 });
        await load(pagination.page);
      } else {
        await api.post("/admin/support-channels", form);
        setMessage("Canal creado correctamente.");
        setForm({ ...emptySupportForm, sortOrder: rows.length + 2 });
        await load(1);
      }
    } catch (err) {
      setError(normalizeError(err, "No se pudo guardar el canal."));
    }
  };

  const patch = async (row, data) => {
    setMessage("");
    setError("");
    try {
      await api.patch(`/admin/support-channels/${row.id}`, data);
      setMessage(data.isActive === false ? "Canal ocultado." : "Canal activado.");
      await load(pagination.page);
    } catch (err) {
      setError(normalizeError(err, "No se pudo actualizar el canal."));
    }
  };

  const remove = async (row) => {
    if (!window.confirm("¿Eliminar este canal de soporte?")) return;
    setMessage("");
    setError("");
    try {
      await api.delete(`/admin/support-channels/${row.id}`);
      setMessage("Canal eliminado.");
      if (editing?.id === row.id) resetForm();
      await load(pagination.page);
    } catch (err) {
      setError(normalizeError(err, "No se pudo eliminar el canal."));
    }
  };

  return (
    <div className="page-stack admin-support-page">
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}
      <div className="two-columns admin-two wide-left">
        <div className="panel-card">
          <div className="section-title">
            <span>Soporte editable</span>
            <h3>Canales publicados</h3>
          </div>
          <AdminTable rows={rows} columns={[
            { key: "label", label: "Canal" },
            { key: "type", label: "Tipo", render: (r) => r.type === "whatsapp" ? <span className="admin-whatsapp-type"><FaWhatsapp /> WhatsApp</span> : r.type },
            { key: "value", label: "Número / valor" },
            { key: "url", label: "Enlace", render: (r) => r.url ? <a className="admin-open-link" href={r.url} target="_blank" rel="noreferrer">Abrir</a> : "—" },
            { key: "isActive", label: "Estado", render: (r) => <StatusBadge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Activo" : "Oculto"}</StatusBadge> },
            {
              key: "actions",
              label: "Acciones",
              render: (r) => (
                <div className="table-actions">
                  <button onClick={() => edit(r)}><FiEdit3 /> Editar</button>
                  <button onClick={() => patch(r, { isActive: !r.isActive })}>{r.isActive ? "Ocultar" : "Activar"}</button>
                  <button onClick={() => remove(r)}><FiTrash2 /> Eliminar</button>
                </div>
              ),
            },
          ]} />
          <PaginationControls page={pagination.page} total={pagination.total} limit={pagination.limit} onPageChange={load} />
        </div>

        <div className="panel-card admin-support-form-card">
          <div className="section-title">
            <span>{editing ? "Editar canal" : "Nuevo canal"}</span>
            <h3>{editing ? "Guardar cambios" : "Agregar enlace"}</h3>
          </div>

          {editing && (
            <div className="admin-editing-note">
              <strong>Editando:</strong>
              <span>{editing.label}</span>
              <button type="button" onClick={resetForm}>Cancelar edición</button>
            </div>
          )}

          <form className="form-stack" onSubmit={save}>
            <label>
              <span>Tipo</span>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="whatsapp">WhatsApp</option>
                <option value="manager">Gerente</option>
                <option value="phone">Teléfono</option>
                <option value="telegram">Telegram</option>
                <option value="security">Seguridad</option>
              </select>
            </label>
            <label>
              <span>Nombre visible</span>
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Ej: Canal oficial WhatsApp" required />
            </label>
            <label>
              <span>Número / valor</span>
              <input value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} placeholder="+51 999 999 999" required />
            </label>
            <label>
              <span>Enlace del botón Abrir</span>
              <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://wa.me/51..." />
            </label>
            <div className="form-grid-2">
              <label>
                <span>Orden</span>
                <input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
              </label>
              <label>
                <span>Estado</span>
                <select value={form.isActive ? "true" : "false"} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === "true" }))}>
                  <option value="true">Activo</option>
                  <option value="false">Oculto</option>
                </select>
              </label>
            </div>
            <label>
              <span>Descripción corta</span>
              <textarea rows="2" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ej: Atención general y anuncios oficiales." />
            </label>
            <button className="primary-btn full" type="submit">
              {editing ? <FiUpload /> : <FiPlus />} {editing ? "Guardar cambios" : "Crear canal"}
            </button>
            {editing && <button className="secondary-btn full" type="button" onClick={resetForm}>Cancelar edición</button>}
          </form>
        </div>
      </div>
    </div>
  );
}

function PrelaunchAdminPanel() {
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewRes, tiktoksRes] = await Promise.all([
        api.get("/prelaunch/admin/overview"),
        api.get("/prelaunch/admin/tiktoks"),
      ]);
      setOverview(overviewRes.data || null);
      setRows(tiktoksRes.data.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Error al cargar pre-lanzamiento.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const statusTone = (status) => {
    if (status === "approved") return "success";
    if (status === "pending") return "warning";
    if (status === "rejected") return "danger";
    return "neutral";
  };

  const statusText = (status) => {
    if (status === "approved") return "Aprobado";
    if (status === "pending") return "Pendiente";
    if (status === "rejected") return "Rechazado";
    return status || "—";
  };

  const tiktokStats = useMemo(() => {
    const base = { pending: 0, approved: 0, rejected: 0 };
    (overview?.stats?.tiktoks || []).forEach((item) => {
      base[item.status] = Number(item.total || 0);
    });
    return base;
  }, [overview]);

  const review = async (row, status) => {
    const note = status === "rejected"
      ? window.prompt("Motivo opcional del rechazo:", row.admin_note || "")
      : "";
    if (note === null) return;

    setMessage("");
    setError("");
    try {
      const res = await api.post(`/prelaunch/admin/tiktoks/${row.id}/review`, { status, note });
      setMessage(res.data?.message || (status === "approved" ? "TikTok aprobado." : "TikTok rechazado."));
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.detail || err?.message || "Error al revisar TikTok.");
    }
  };

  return (
    <div className="page-stack admin-prelaunch-page">
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="prelaunch-admin-stat-grid">
        <article className="prelaunch-admin-stat-card warning">
          <span><FiVideo /></span>
          <small>TikToks pendientes</small>
          <strong>{compact(tiktokStats.pending)}</strong>
        </article>
        <article className="prelaunch-admin-stat-card success">
          <span><FiCheckCircle /></span>
          <small>TikToks aprobados</small>
          <strong>{compact(tiktokStats.approved)}</strong>
        </article>
        <article className="prelaunch-admin-stat-card danger">
          <span><FiAlertTriangle /></span>
          <small>TikToks rechazados</small>
          <strong>{compact(tiktokStats.rejected)}</strong>
        </article>
        <article className="prelaunch-admin-stat-card bonus">
          <span><FiGift /></span>
          <small>Bono máximo</small>
          <strong>{money(overview?.config?.maxBonusUsdt || 10)}</strong>
        </article>
      </div>

      <div className="two-columns admin-two wide-left">
        <div className="panel-card">
          <div className="section-title">
            <span>Pre-lanzamiento</span>
            <h3>Enlaces de TikTok enviados</h3>
          </div>
          <AdminTable
            rows={rows}
            empty="Aún no hay enlaces de TikTok enviados."
            columns={[
              { key: "user", label: "Usuario", render: (r) => <div className="admin-user-cell"><strong>{r.email}</strong><small>ID {r.user_id || r.userId} · Ref {r.referral_code || "—"}</small></div> },
              { key: "tiktok_url", label: "Enlace", render: (r) => r.tiktok_url ? <a className="admin-open-link" href={r.tiktok_url} target="_blank" rel="noreferrer"><FiExternalLink /> Abrir TikTok</a> : "—" },
              { key: "reward_usdt", label: "Bono", render: (r) => money(r.reward_usdt || 4) },
              { key: "status", label: "Estado", render: (r) => <StatusBadge tone={statusTone(r.status)}>{statusText(r.status)}</StatusBadge> },
              { key: "created_at", label: "Enviado", render: (r) => shortDate(r.created_at) },
              { key: "admin_note", label: "Nota", render: (r) => r.admin_note || "—" },
              {
                key: "actions",
                label: "Acciones",
                render: (r) => (
                  <div className="table-actions">
                    <button onClick={() => review(r, "approved")} disabled={r.status === "approved"}><FiCheckCircle /> Aprobar</button>
                    <button onClick={() => review(r, "rejected")} disabled={r.status === "approved"}><FiAlertTriangle /> Rechazar</button>
                  </div>
                ),
              },
            ]}
          />
        </div>

        <div className="panel-card admin-prelaunch-guide">
          <div className="section-title">
            <span>Administración</span>
            <h3>Cómo validar TikToks</h3>
          </div>
          <div className="admin-guide-list">
            <p><strong>1.</strong> Abre el enlace enviado por el usuario.</p>
            <p><strong>2.</strong> Verifica que promocione Royal Imperial AI.</p>
            <p><strong>3.</strong> Pulsa <b>Aprobar</b> para acreditar el bono.</p>
            <p><strong>4.</strong> Pulsa <b>Rechazar</b> si no cumple y agrega una nota.</p>
          </div>
          <div className="upload-note">
            <small>Al aprobar, el bono se acredita al saldo de garantía del usuario. Si el usuario ya tenía un TikTok aprobado, no se duplica el bono.</small>
          </div>
          <button className="secondary-btn full" type="button" onClick={load} disabled={loading}><FiRefreshCw /> Actualizar lista</button>
        </div>
      </div>
    </div>
  );
}


const emptySection = () => ({ id: `${Date.now()}-${Math.random()}`, type: "paragraph", title: "", text: "", imageUrl: "", imageAlt: "" });
function NewsAdminPanel() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: ADMIN_PAGE_SIZE });
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const load = useCallback(async (page = 1) => {
    const res = await api.get(`/admin/articles?page=${page}&limit=${ADMIN_PAGE_SIZE}`);
    setRows(res.data.articles || []);
    setPagination(res.data.pagination || { page, total: 0, limit: ADMIN_PAGE_SIZE });
  }, []);
  useEffect(() => { load(1).catch(() => {}); }, [load]);
  const startNew = () => setEditing({ title: "", slug: "", summary: "", coverImageUrl: "", status: "draft", sortOrder: 0, publishedAt: "", sections: [emptySection()] });
  const edit = (row) => setEditing({ ...row, publishedAt: toDateTimeLocal(row.publishedAt), sections: row.sections?.length ? row.sections : [emptySection()] });
  const save = async (e) => {
    e.preventDefault();
    try {
      const wasEditing = Boolean(editing.id);
      if (wasEditing) await api.patch(`/admin/articles/${editing.id}`, editing);
      else await api.post("/admin/articles", editing);
      setMessage("Noticia guardada correctamente.");
      setEditing(null);
      await load(wasEditing ? pagination.page : 1);
    } catch (err) {
      setMessage(err?.response?.data?.message || err?.message || "Error al guardar noticia.");
    }
  };
  const remove = async (row) => { if (!window.confirm("¿Eliminar esta noticia?")) return; await api.delete(`/admin/articles/${row.id}`); await load(pagination.page); };
  const updateSection = (idx, patch) => setEditing((prev) => ({ ...prev, sections: prev.sections.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  const addSection = () => setEditing((prev) => ({ ...prev, sections: [...(prev.sections || []), emptySection()] }));
  const insertSectionAt = (idx) => setEditing((prev) => {
    const sections = [...(prev.sections || [])];
    const safeIndex = Math.max(0, Math.min(idx, sections.length));
    sections.splice(safeIndex, 0, emptySection());
    return { ...prev, sections };
  });
  const insertSectionAfter = (idx) => insertSectionAt(idx + 1);
  const moveSection = (idx, direction) => setEditing((prev) => {
    const sections = [...(prev.sections || [])];
    const nextIndex = idx + direction;
    if (nextIndex < 0 || nextIndex >= sections.length) return prev;
    const [section] = sections.splice(idx, 1);
    sections.splice(nextIndex, 0, section);
    return { ...prev, sections };
  });
  const removeSection = (idx) => setEditing((prev) => ({ ...prev, sections: prev.sections.filter((_, i) => i !== idx) }));
  return (
    <div className="page-stack">
      {message && <div className="alert success">{message}</div>}
      <div className="panel-card">
        <div className="section-title"><span>Noticias</span><h3>Artículos publicados y borradores</h3></div>
        <button className="primary-btn" type="button" onClick={startNew}><FiPlus /> Nueva noticia</button>
        <AdminTable rows={rows} columns={[
          { key: "title", label: "Título", render: (r) => <button className="link-btn" onClick={() => edit(r)}>{r.title}</button> },
          { key: "status", label: "Estado", render: (r) => <StatusBadge tone={r.status === "published" ? "success" : "warning"}>{r.status === "published" ? "Publicado" : "Borrador"}</StatusBadge> },
          { key: "slug", label: "Ruta" },
          { key: "sections", label: "Secciones", render: (r) => r.sections?.length || 0 },
          { key: "publishedAt", label: "Publicado", render: (r) => r.publishedAt ? shortDate(r.publishedAt) : "—" },
          { key: "updatedAt", label: "Actualizado", render: (r) => shortDate(r.updatedAt) },
          { key: "actions", label: "Acciones", render: (r) => <div className="table-actions"><button onClick={() => edit(r)}>Editar</button><button onClick={() => remove(r)}>Eliminar</button></div> },
        ]} />
        <PaginationControls page={pagination.page} total={pagination.total} limit={pagination.limit} onPageChange={load} />
      </div>
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form className="admin-modal article-editor-modal" onSubmit={save} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><span className="eyebrow">Editor de noticia</span><h3>{editing.id ? "Editar artículo" : "Crear artículo"}</h3></div><button type="button" className="icon-btn" onClick={() => setEditing(null)}>×</button></div>
            <div className="article-editor-grid">
              <label><span>Título</span><input value={editing.title} onChange={(e) => setEditing((f) => ({ ...f, title: e.target.value }))} required /></label>
              <label><span>Slug opcional</span><input value={editing.slug || ""} onChange={(e) => setEditing((f) => ({ ...f, slug: e.target.value }))} placeholder="se-genera-automatico" /></label>
              <label><span>Estado</span><select value={editing.status} onChange={(e) => setEditing((f) => ({ ...f, status: e.target.value }))}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select></label>
              <label><span>Fecha de publicación</span><input type="datetime-local" value={editing.publishedAt || ""} onChange={(e) => setEditing((f) => ({ ...f, publishedAt: e.target.value }))} /></label>
              <label><span>Orden</span><input type="number" value={editing.sortOrder || 0} onChange={(e) => setEditing((f) => ({ ...f, sortOrder: Number(e.target.value) }))} /></label>
              <label className="article-editor-full"><span>Resumen</span><textarea rows="3" value={editing.summary || ""} onChange={(e) => setEditing((f) => ({ ...f, summary: e.target.value }))} /></label>
              <label className="article-editor-full"><span>Ruta o URL de portada</span><input value={editing.coverImageUrl || ""} onChange={(e) => setEditing((f) => ({ ...f, coverImageUrl: e.target.value }))} placeholder="/uploads/news/noticia-bienvenida.webp o https://..." /></label>
              <div className="article-editor-full upload-note"><strong>Formato disponible</strong><small>En Resumen y Texto puedes usar: <code>**negrita**</code>, <code>*cursiva*</code>, <code>`código`</code>, listas con <code>- item</code>, títulos con <code>## Título</code>, citas con <code>&gt; texto</code> y enlaces como <code>[texto](https://ejemplo.com)</code>.</small></div>
              <div className="article-editor-full upload-note"><strong>Imágenes por GitHub</strong><small>Sube la imagen manualmente a <code>frontend/public/uploads/news/</code>, haz commit/push y pega aquí la ruta pública. Ejemplo: <code>/uploads/news/noticia-bienvenida.webp</code>. También puedes pegar una URL externa si algún día usas ImageKit, Supabase o Drive.</small></div>
            </div>
            {editing.coverImageUrl && <img className="article-cover-preview" src={imageUrl(editing.coverImageUrl)} alt="Portada" />}
            <div className="section-title"><span>Contenido</span><h3>Secciones del artículo</h3></div>
            <div className="upload-note article-section-help"><small>Ahora puedes insertar una sección arriba o debajo de cualquier bloque. El orden visible aquí será el mismo orden que verá el usuario en la noticia.</small></div>
            <div className="article-sections-editor">
              {(editing.sections || []).map((section, idx) => (
                <div className="article-section-form" key={section.id || idx}>
                  <div className="article-section-head">
                    <strong>Sección {idx + 1}</strong>
                    <div className="article-section-actions">
                      <button type="button" className="section-action-btn" onClick={() => insertSectionAt(idx)}>+ arriba</button>
                      <button type="button" className="section-action-btn" onClick={() => insertSectionAfter(idx)}>+ abajo</button>
                      <button type="button" className="section-action-btn compact" onClick={() => moveSection(idx, -1)} disabled={idx === 0}>↑</button>
                      <button type="button" className="section-action-btn compact" onClick={() => moveSection(idx, 1)} disabled={idx === (editing.sections || []).length - 1}>↓</button>
                      <button type="button" className="icon-btn danger-icon" onClick={() => removeSection(idx)}><FiTrash2 /></button>
                    </div>
                  </div>
                  <label><span>Tipo</span><select value={section.type} onChange={(e) => updateSection(idx, { type: e.target.value })}><option value="paragraph">Párrafo</option><option value="heading">Título</option><option value="image">Imagen</option><option value="quote">Cita</option></select></label>
                  <label><span>Título / alt</span><input value={section.title || ""} onChange={(e) => updateSection(idx, { title: e.target.value, imageAlt: e.target.value })} /></label>
                  {section.type === "image" && <><label><span>Ruta o URL imagen</span><input value={section.imageUrl || ""} onChange={(e) => updateSection(idx, { imageUrl: e.target.value })} placeholder="/uploads/news/seccion-1.webp o https://..." /></label><div className="upload-note"><small>Usa imágenes guardadas en <code>frontend/public/uploads/news/</code> o una URL externa.</small></div>{section.imageUrl && <img className="section-image-preview" src={imageUrl(section.imageUrl)} alt="Vista" />}</>}
                  <label className="article-editor-full"><span>Texto</span><textarea rows={section.type === "paragraph" ? 5 : 3} value={section.text || ""} onChange={(e) => updateSection(idx, { text: e.target.value })} /></label>
                </div>
              ))}
            </div>
            <button className="secondary-btn" type="button" onClick={addSection}><FiPlus /> Agregar sección</button>
            <button className="primary-btn full" type="submit"><FiUpload /> Guardar noticia</button>
          </form>
        </div>
      )}
    </div>
  );
}



function RouletteAdminPanel() {
  const [prizes, setPrizes] = useState([]);
  const [spins, setSpins] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: ADMIN_PAGE_SIZE });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    label: "0.5 USDT",
    prizeType: "withdrawable",
    amountUsdt: "0.5",
    creditPoints: 0,
    probabilityWeight: 70,
    colorKey: "gold",
    sortOrder: 1,
    isActive: true,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadPrizes = useCallback(async () => {
    const res = await api.get("/admin/roulette/prizes");
    setPrizes(res.data.prizes || []);
  }, []);

  const loadSpins = useCallback(async (page = 1) => {
    const res = await api.get(`/admin/roulette/spins?page=${page}&limit=${ADMIN_PAGE_SIZE}`);
    setSpins(res.data.spins || []);
    setPagination(res.data.pagination || { page, total: 0, limit: ADMIN_PAGE_SIZE });
  }, []);

  useEffect(() => { loadPrizes().catch(() => {}); loadSpins(1).catch(() => {}); }, [loadPrizes, loadSpins]);

  const startEdit = (row) => {
    setEditing(row);
    setForm({
      label: row.label || "",
      prizeType: row.prizeType || "withdrawable",
      amountUsdt: row.amountUsdt || 0,
      creditPoints: row.creditPoints || 0,
      probabilityWeight: row.probabilityWeight || 0,
      colorKey: row.colorKey || "gold",
      sortOrder: row.sortOrder || 0,
      isActive: row.isActive !== false,
    });
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ label: "", prizeType: "withdrawable", amountUsdt: "", creditPoints: 0, probabilityWeight: 1, colorKey: "gold", sortOrder: prizes.length + 1, isActive: true });
  };

  const savePrize = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      if (editing?.id) await api.patch(`/admin/roulette/prizes/${editing.id}`, form);
      else await api.post("/admin/roulette/prizes", form);
      setMessage(editing?.id ? "Premio actualizado." : "Premio creado.");
      resetForm();
      await loadPrizes();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo guardar el premio.");
    }
  };

  const totalWeight = prizes.filter((p) => p.isActive).reduce((sum, p) => sum + Number(p.probabilityWeight || 0), 0);

  const prizeColumns = [
    { key: "label", label: "Premio", render: (r) => <strong>{r.label}</strong> },
    { key: "amountUsdt", label: "Monto", render: (r) => r.prizeType === "credit_points" ? `${r.creditPoints} pts` : r.prizeType === "none" ? "Sin premio" : money(r.amountUsdt) },
    { key: "probabilityWeight", label: "Peso", render: (r) => Number(r.probabilityWeight || 0).toFixed(2) },
    { key: "chance", label: "Aprox.", render: (r) => totalWeight > 0 && r.isActive ? `${((Number(r.probabilityWeight || 0) / totalWeight) * 100).toFixed(2)}%` : "0%" },
    { key: "isActive", label: "Estado", render: (r) => <StatusBadge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Activo" : "Inactivo"}</StatusBadge> },
    { key: "action", label: "Acción", render: (r) => <button className="secondary-btn small-btn" type="button" onClick={() => startEdit(r)}>Editar</button> },
  ];

  const spinColumns = [
    { key: "userEmail", label: "Usuario", render: (r) => r.userEmail || r.referralCode || "—" },
    { key: "prizeLabel", label: "Premio", render: (r) => <strong>{r.prizeLabel}</strong> },
    { key: "amountUsdt", label: "Monto", render: (r) => money(r.amountUsdt) },
    { key: "createdAt", label: "Fecha", render: (r) => shortDate(r.createdAt) },
  ];

  return (
    <div className="page-stack">
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="two-columns admin-two">
        <form className="panel-card form-stack admin-roulette-form" onSubmit={savePrize}>
          <div className="section-title"><span>Premios</span><h3>{editing?.id ? "Editar premio" : "Crear premio"}</h3></div>
          <label><span>Nombre visible</span><input value={form.label} onChange={(e)=>setForm({...form,label:e.target.value})} placeholder="Ej: 0.5 USDT" required /></label>
          <div className="form-grid-2">
            <label><span>Tipo</span><select value={form.prizeType} onChange={(e)=>setForm({...form,prizeType:e.target.value})}><option value="withdrawable">Saldo retirable</option><option value="recharge">Saldo de garantía</option><option value="credit_points">Puntos de crédito</option><option value="none">Sin premio</option></select></label>
            <label><span>Monto USDT</span><input type="number" step="0.01" min="0" value={form.amountUsdt} onChange={(e)=>setForm({...form,amountUsdt:e.target.value})} /></label>
          </div>
          <div className="form-grid-2">
            <label><span>Puntos crédito</span><input type="number" min="0" step="1" value={form.creditPoints} onChange={(e)=>setForm({...form,creditPoints:e.target.value})} /></label>
            <label><span>Peso / probabilidad</span><input type="number" step="0.0001" min="0" value={form.probabilityWeight} onChange={(e)=>setForm({...form,probabilityWeight:e.target.value})} /></label>
          </div>
          <div className="form-grid-2">
            <label><span>Orden</span><input type="number" value={form.sortOrder} onChange={(e)=>setForm({...form,sortOrder:e.target.value})} /></label>
            <label><span>Estado</span><select value={form.isActive ? "true" : "false"} onChange={(e)=>setForm({...form,isActive:e.target.value==="true"})}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
          </div>
          <button className="primary-btn" type="submit"><FiRefreshCw /> Guardar premio</button>
          {editing?.id && <button className="secondary-btn" type="button" onClick={resetForm}>Nuevo premio</button>}
          <p className="muted-text small">A mayor peso, mayor posibilidad de aparecer. El resultado real siempre lo decide el backend.</p>
        </form>

        <section className="panel-card">
          <div className="section-title"><span>Configuración</span><h3>Premios activos</h3></div>
          <AdminTable rows={prizes} columns={prizeColumns} empty="Sin premios configurados." />
        </section>
      </div>

      <section className="panel-card">
        <div className="section-title"><span>Historial</span><h3>Últimos giros</h3></div>
        <AdminTable rows={spins} columns={spinColumns} empty="Sin giros registrados." />
        <PaginationControls page={pagination.page} total={pagination.total} limit={pagination.limit} onPageChange={loadSpins} />
      </section>
    </div>
  );
}


function RedeemCodesAdminPanel() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: ADMIN_PAGE_SIZE });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    code: "",
    balanceType: "recharge",
    amountUsdt: "",
    maxUses: 1,
    expiresAt: "",
    note: "",
  });
  const [limitConfig, setLimitConfig] = useState({
    isActive: true,
    standardDailyLimit: 1,
    premiumDailyLimit: 3,
    premiumFromLevel: 3,
    noPlanGuaranteeCapActive: true,
    noPlanGuaranteeCapUsdt: 5,
    noPlanWithdrawableCapActive: true,
    noPlanWithdrawableCapUsdt: 5,
  });
  const [savingLimits, setSavingLimits] = useState(false);

  const loadLimitConfig = useCallback(async () => {
    try {
      const res = await api.get("/admin/redeem-codes/daily-limit-config");
      const config = res.data.config || {};
      setLimitConfig({
        isActive: config.isActive !== false,
        standardDailyLimit: Number(config.standardDailyLimit || 1),
        premiumDailyLimit: Number(config.premiumDailyLimit || 3),
        premiumFromLevel: Number(config.premiumFromLevel || 3),
        noPlanGuaranteeCapActive: config.noPlanGuaranteeCapActive !== false,
        noPlanGuaranteeCapUsdt: Number(config.noPlanGuaranteeCapUsdt || 5),
        noPlanWithdrawableCapActive: config.noPlanWithdrawableCapActive !== false,
        noPlanWithdrawableCapUsdt: Number(config.noPlanWithdrawableCapUsdt || 5),
      });
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const load = useCallback(async (page = pagination.page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page, limit: ADMIN_PAGE_SIZE, search });
      const res = await api.get(`/admin/redeem-codes?${params.toString()}`);
      setRows(res.data.rows || []);
      setPagination({ page: res.data.page || page, total: res.data.total || 0, limit: res.data.limit || ADMIN_PAGE_SIZE });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, search]);

  useEffect(() => { load(1).catch(() => {}); loadLimitConfig().catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveLimitConfig = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setSavingLimits(true);
    try {
      const res = await api.patch("/admin/redeem-codes/daily-limit-config", limitConfig);
      setLimitConfig(res.data.config || limitConfig);
      setMessage(res.data.message || "Límites diarios actualizados.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingLimits(false);
    }
  };

  const createCode = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.post("/admin/redeem-codes", form);
      setMessage("Código creado correctamente.");
      setForm({ code: "", balanceType: "recharge", amountUsdt: "", maxUses: 1, expiresAt: "", note: "" });
      await load(1);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleCode = async (row) => {
    setMessage("");
    setError("");
    try {
      await api.patch(`/admin/redeem-codes/${row.id}`, { isActive: !row.is_active });
      setMessage(!row.is_active ? "Código habilitado." : "Código deshabilitado.");
      await load(pagination.page);
    } catch (err) {
      setError(err.message);
    }
  };

  const columns = [
    { key: "code", label: "Código", render: (r) => <strong>{r.code}</strong> },
    { key: "balance_type", label: "Saldo", render: (r) => r.balance_type === "recharge" ? "Garantía" : "Retirable" },
    { key: "amount_usdt", label: "Monto", render: (r) => money(r.amount_usdt) },
    { key: "used_count", label: "Usos", render: (r) => `${r.used_count || 0}/${r.max_uses || 1}` },
    { key: "is_active", label: "Estado", render: (r) => <StatusBadge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Activo" : "Inactivo"}</StatusBadge> },
    { key: "created_at", label: "Creado", render: (r) => shortDate(r.created_at) },
    { key: "action", label: "Acción", render: (r) => <button className="secondary-btn small-btn" type="button" onClick={() => toggleCode(r)}>{r.is_active ? "Deshabilitar" : "Habilitar"}</button> },
  ];

  return (
    <div className="page-stack">
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <form className="panel-card form-stack admin-redeem-limit-panel" onSubmit={saveLimitConfig}>
        <div className="section-title">
          <span>Control diario</span>
          <h3>Límite de códigos por nivel</h3>
        </div>
        <div className="form-grid-2 redeem-limit-grid">
          <label>
            Pasantía, R1 y R2
            <input
              type="number"
              min="1"
              max="20"
              value={limitConfig.standardDailyLimit}
              onChange={(e)=>setLimitConfig({...limitConfig, standardDailyLimit:Number(e.target.value)})}
            />
            <small>Códigos permitidos por día</small>
          </label>
          <label>
            R{limitConfig.premiumFromLevel} en adelante
            <input
              type="number"
              min="1"
              max="20"
              value={limitConfig.premiumDailyLimit}
              onChange={(e)=>setLimitConfig({...limitConfig, premiumDailyLimit:Number(e.target.value)})}
            />
            <small>Códigos permitidos por día</small>
          </label>
        </div>
        <div className="form-grid-2 redeem-limit-grid secondary-row">
          <label>
            Nivel que inicia el límite superior
            <select
              value={limitConfig.premiumFromLevel}
              onChange={(e)=>setLimitConfig({...limitConfig, premiumFromLevel:Number(e.target.value)})}
            >
              {[1,2,3,4,5,6,7,8].map((level)=><option key={level} value={level}>R{level}</option>)}
            </select>
          </label>
          <label>
            Estado del límite diario
            <select
              value={limitConfig.isActive ? "true" : "false"}
              onChange={(e)=>setLimitConfig({...limitConfig, isActive:e.target.value === "true"})}
            >
              <option value="true">Activo</option>
              <option value="false">Desactivado</option>
            </select>
          </label>
        </div>
        <div className="form-grid-2 redeem-limit-grid secondary-row">
          <label>
            Tope de garantía sin plan
            <input
              type="number"
              min="0.01"
              step="0.01"
              max="100000"
              value={limitConfig.noPlanGuaranteeCapUsdt}
              onChange={(e)=>setLimitConfig({...limitConfig, noPlanGuaranteeCapUsdt:Number(e.target.value)})}
            />
            <small>Máximo en saldo de garantía por códigos para Pasantía o sin plan</small>
          </label>
          <label>
            Estado del tope de garantía
            <select
              value={limitConfig.noPlanGuaranteeCapActive ? "true" : "false"}
              onChange={(e)=>setLimitConfig({...limitConfig, noPlanGuaranteeCapActive:e.target.value === "true"})}
            >
              <option value="true">Activo</option>
              <option value="false">Desactivado</option>
            </select>
          </label>
        </div>
        <div className="form-grid-2 redeem-limit-grid secondary-row">
          <label>
            Tope retirable sin plan
            <input
              type="number"
              min="0.01"
              step="0.01"
              max="100000"
              value={limitConfig.noPlanWithdrawableCapUsdt}
              onChange={(e)=>setLimitConfig({...limitConfig, noPlanWithdrawableCapUsdt:Number(e.target.value)})}
            />
            <small>Máximo en saldo retirable por códigos para Pasantía o sin plan</small>
          </label>
          <label>
            Estado del tope retirable
            <select
              value={limitConfig.noPlanWithdrawableCapActive ? "true" : "false"}
              onChange={(e)=>setLimitConfig({...limitConfig, noPlanWithdrawableCapActive:e.target.value === "true"})}
            >
              <option value="true">Activo</option>
              <option value="false">Desactivado</option>
            </select>
          </label>
        </div>
        <div className="redeem-limit-summary">
          <strong>Configuración actual:</strong>
          <span>Pasantía hasta R{Math.max(0, Number(limitConfig.premiumFromLevel || 3) - 1)}: {limitConfig.standardDailyLimit} código(s) al día.</span>
          <span>R{limitConfig.premiumFromLevel} en adelante: {limitConfig.premiumDailyLimit} código(s) al día.</span>
          <span>Reinicio diario: 00:00 GMT-5.</span>
          <span>Sin plan o Pasantía: máximo {Number(limitConfig.noPlanGuaranteeCapUsdt || 5).toFixed(2)} USDT en garantía mediante códigos.</span>
          <span>Sin plan o Pasantía: máximo {Number(limitConfig.noPlanWithdrawableCapUsdt || 5).toFixed(2)} USDT retirables mediante códigos.</span>
        </div>
        <button className="primary-btn" type="submit" disabled={savingLimits}>
          {savingLimits ? "Guardando..." : "Guardar límites diarios"}
        </button>
      </form>

      <div className="two-columns admin-two">
        <form className="panel-card form-stack admin-redeem-form" onSubmit={createCode}>
          <div className="section-title"><span>Nuevo código</span><h3>Crear código de canje</h3></div>
          <label>Código<input value={form.code} onChange={(e)=>setForm({...form, code:e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,"")})} placeholder="EJ: ROYAL100" /></label>
          <div className="form-grid-2">
            <label>Tipo de saldo<select value={form.balanceType} onChange={(e)=>setForm({...form,balanceType:e.target.value})}><option value="recharge">Saldo de garantía</option><option value="withdrawable">Saldo retirable</option></select></label>
            <label>Monto USDT<input type="number" step="0.01" min="0" value={form.amountUsdt} onChange={(e)=>setForm({...form,amountUsdt:e.target.value})} placeholder="0.00" /></label>
          </div>
          <div className="form-grid-2">
            <label>Límite total de usos<input type="number" min="1" value={form.maxUses} onChange={(e)=>setForm({...form,maxUses:e.target.value})} /></label>
            <label>Vence opcional<input type="datetime-local" value={form.expiresAt} onChange={(e)=>setForm({...form,expiresAt:e.target.value})} /></label>
          </div>
          <label>Nota interna<input value={form.note} onChange={(e)=>setForm({...form,note:e.target.value})} placeholder="Motivo o campaña" /></label>
          <button className="primary-btn"><FiPlus /> Crear código</button>
          <p className="muted-text small">Cada usuario solo puede usar el mismo código una vez. Además, se aplica el límite diario configurado por nivel.</p>
        </form>

        <section className="panel-card">
          <div className="section-title"><span>Buscar</span><h3>Códigos registrados</h3></div>
          <div className="filter-row">
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar código" />
            <button className="secondary-btn" type="button" onClick={() => load(1)} disabled={loading}><FiSearch /> Buscar</button>
          </div>
          <AdminTable columns={columns} rows={rows} empty="Sin códigos registrados." />
          <PaginationControls page={pagination.page} total={pagination.total} limit={pagination.limit} onPageChange={load} loading={loading} />
        </section>
      </div>
    </div>
  );
}


function SecurityPanel() {
  const [data, setData] = useState(null);
  const [ipDetail, setIpDetail] = useState(null);
  const [loadingIp, setLoadingIp] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    const res = await api.get("/admin/security");
    setData(res.data);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const openIpDetail = async (ip) => {
    if (!ip) return;
    setLoadingIp(true);
    setActionMessage("");
    setActionError("");
    try {
      const res = await api.get(`/admin/security/ip-users?ip=${encodeURIComponent(ip)}`);
      setIpDetail(res.data);
    } catch (err) {
      setActionError(err.response?.data?.message || "No se pudo cargar usuarios de la IP.");
    } finally {
      setLoadingIp(false);
    }
  };

  const updateUserSecurity = async (user, patch) => {
    setActionMessage("");
    setActionError("");
    try {
      await api.patch(`/admin/users/${user.id}`, patch);
      setActionMessage("Usuario actualizado correctamente.");
      if (ipDetail?.ip) await openIpDetail(ipDetail.ip);
      await load();
    } catch (err) {
      setActionError(err.response?.data?.message || "No se pudo actualizar el usuario.");
    }
  };

  return (
    <div className="page-stack">
      {actionMessage && <div className="alert success">{actionMessage}</div>}
      {actionError && <div className="alert error">{actionError}</div>}
      <div className="metric-grid admin-metrics">
        <MetricCard icon={<FiAlertTriangle />} label="Sospechosos" value={compact(data?.suspiciousUsers?.length)} />
        <MetricCard icon={<FiShield />} label="Baneados" value={compact(data?.bannedUsers?.length)} />
        <MetricCard icon={<FiDatabase />} label="IPs repetidas" value={compact(data?.ipGroups?.length)} />
        <MetricCard icon={<FiActivity />} label="Eventos" value={compact(data?.events?.length)} />
      </div>

      <div className="two-columns admin-two">
        <div className="panel-card">
          <div className="section-title">
            <span>IPs</span>
            <h3>Registros repetidos</h3>
          </div>
          <PaginatedAdminTable
            pageSize={10}
            rows={data?.ipGroups || []}
            columns={[
              { key: "ip_address", label: "IP" },
              { key: "accounts", label: "Cuentas" },
              {
                key: "actions",
                label: "Usuarios",
                render: (r) => (
                  <button className="table-action-btn" type="button" onClick={() => openIpDetail(r.ip_address)} disabled={loadingIp}>
                    Ver usuarios
                  </button>
                ),
              },
            ]}
          />
        </div>

        <div className="panel-card">
          <div className="section-title">
            <span>Eventos</span>
            <h3>Últimos registros</h3>
          </div>
          <PaginatedAdminTable
            pageSize={10}
            rows={data?.events || []}
            columns={[
              { key: "event_type", label: "Evento" },
              { key: "user_email", label: "Usuario" },
              { key: "ip_address", label: "IP" },
              { key: "created_at", label: "Fecha", render: (r) => shortDate(r.created_at) },
            ]}
          />
        </div>
      </div>

      {ipDetail && (
        <div className="modal-backdrop" onClick={() => setIpDetail(null)}>
          <div className="admin-modal admin-ip-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">Multicuenta / IP repetida</span>
                <h3>{ipDetail.ip}</h3>
                <p>{compact(ipDetail.users?.length)} usuarios relacionados por registro o login.</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setIpDetail(null)}>×</button>
            </div>

            <PaginatedAdminTable
              pageSize={12}
              rows={ipDetail.users || []}
              empty="No se encontraron usuarios para esta IP."
              columns={[
                { key: "email", label: "Usuario" },
                { key: "active_level", label: "Nivel", render: (r) => Number(r.active_level || 0) >= 1 ? `R${r.active_level}` : "Sin nivel" },
                { key: "ip_match", label: "Coincidencia" },
                { key: "recharge_balance_usdt", label: "Garantía", render: (r) => money(r.recharge_balance_usdt) },
                { key: "withdrawable_usdt", label: "Retirable", render: (r) => money(r.withdrawable_usdt) },
                { key: "status", label: "Estado", render: (r) => <div className="badge-row">{r.is_suspicious && <StatusBadge tone="warning">Sospechoso</StatusBadge>}{r.is_banned && <StatusBadge tone="danger">Baneado</StatusBadge>}{!r.is_suspicious && !r.is_banned && <StatusBadge tone="success">Normal</StatusBadge>}{r.withdraw_enabled && <StatusBadge>Retiro OK</StatusBadge>}</div> },
                { key: "created_at", label: "Registro", render: (r) => shortDate(r.created_at) },
                {
                  key: "actions",
                  label: "Acción",
                  render: (r) => (
                    <div className="table-actions security-actions">
                      <button
                        type="button"
                        onClick={() => updateUserSecurity(r, { isSuspicious: !r.is_suspicious, suspiciousReason: r.is_suspicious ? "" : `IP repetida detectada: ${ipDetail.ip}` })}
                      >
                        {r.is_suspicious ? "Quitar sospecha" : "Marcar sospechoso"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateUserSecurity(r, { isBanned: !r.is_banned, bannedReason: r.is_banned ? "" : `Posible multicuenta por IP repetida: ${ipDetail.ip}` })}
                      >
                        {r.is_banned ? "Desbanear" : "Banear"}
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CreditPointsPanel() {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: ADMIN_PAGE_SIZE });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ userId: "", operation: "add", points: "", reason: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page, limit: ADMIN_PAGE_SIZE, search });
      const res = await api.get(`/admin/credit-points/users?${params.toString()}`);
      setRows(res.data.users || []);
      setPagination(res.data.pagination || { page, total: 0, limit: ADMIN_PAGE_SIZE });
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo cargar puntos de crédito.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(1).catch(() => {}); }, [load]);

  const openHistory = async (user) => {
    setSelected(user);
    setForm((f) => ({ ...f, userId: String(user.id) }));
    const res = await api.get(`/admin/users/${user.id}/credit-points/history`);
    setHistory(res.data.events || []);
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    const userId = form.userId || selected?.id;
    if (!userId) {
      setError("Selecciona un usuario.");
      return;
    }
    try {
      await api.post(`/admin/users/${userId}/credit-points`, {
        operation: form.operation,
        points: form.points,
        reason: form.reason,
      });
      setMessage("Puntos de crédito actualizados.");
      setForm((f) => ({ ...f, points: "", reason: "" }));
      await load(pagination.page);
      const refreshed = rows.find((item) => Number(item.id) === Number(userId)) || selected;
      if (refreshed) await openHistory({ ...refreshed, id: userId });
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo ajustar puntos.");
    }
  };

  return (
    <div className="page-stack">
      <div className="page-header-card admin-main-header">
        <div>
          <span className="eyebrow">Puntos de crédito</span>
          <h2>Control de reputación</h2>
          <p>Administra puntos, motivos e historial de cada usuario. Solo administradores pueden modificar este módulo.</p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => load(pagination.page)} disabled={loading}><FiRefreshCw /> Actualizar</button>
      </div>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="two-columns admin-two wide-left credit-points-admin-grid">
        <div className="panel-card">
          <div className="section-title"><span>Usuarios</span><h3>Puntos actuales</h3></div>
          <div className="admin-filters compact-filters">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar correo, ID o nombre" />
            <button className="secondary-btn" type="button" onClick={() => load(1)}><FiSearch /> Buscar</button>
          </div>
          <AdminTable
            rows={rows}
            columns={[
              { key: "email", label: "Usuario" },
              { key: "referral_code", label: "ID" },
              { key: "credit_points", label: "Puntos", render: (r) => <strong className="credit-points-value">{r.credit_points}</strong> },
              { key: "estado", label: "Estado", render: (r) => r.withdraw_enabled ? <StatusBadge tone="success">Retiro habilitado</StatusBadge> : <StatusBadge tone="warning">Pendiente</StatusBadge> },
              { key: "validated_invites", label: "Invitados", render: (r) => compact(r.validated_invites) },
              { key: "actions", label: "Acción", render: (r) => <button className="secondary-btn mini" type="button" onClick={() => openHistory(r)}>Gestionar</button> },
            ]}
          />
          <PaginationControls page={pagination.page} total={pagination.total} limit={pagination.limit} onPageChange={load} loading={loading} />
        </div>

        <div className="panel-card">
          <div className="section-title"><span>Ajuste manual</span><h3>{selected ? selected.email : "Selecciona usuario"}</h3></div>
          <p className="muted-text">Reglas automáticas: 50 base, 60 contacto, 70 cuenta retiro, 80 recarga, 90 retiro habilitado y +1 por invitado validado.</p>
          <form className="admin-balance-form credit-points-form" onSubmit={submitAdjust}>
            <label>
              <span>Usuario</span>
              <select value={form.userId} onChange={(e) => {
                const user = rows.find((item) => String(item.id) === e.target.value);
                setForm((f) => ({ ...f, userId: e.target.value }));
                if (user) openHistory(user).catch(() => {});
              }}>
                <option value="">Selecciona usuario</option>
                {rows.map((item) => <option key={item.id} value={item.id}>{item.email} · {item.credit_points} pts</option>)}
              </select>
            </label>
            <label>
              <span>Operación</span>
              <select value={form.operation} onChange={(e) => setForm((f) => ({ ...f, operation: e.target.value }))}>
                <option value="add">Sumar</option>
                <option value="subtract">Restar</option>
                <option value="set">Fijar total</option>
              </select>
            </label>
            <label>
              <span>Puntos</span>
              <input type="number" min="0" step="1" value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))} placeholder="0" required />
            </label>
            <label className="admin-balance-reason">
              <span>Motivo</span>
              <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Ej: verificación manual, infracción, soporte..." required />
            </label>
            <button className="primary-btn" type="submit">Guardar puntos</button>
          </form>

          <div className="section-title compact-title"><span>Historial</span><h3>Últimos movimientos</h3></div>
          <PaginatedAdminTable
            rows={history}
            pageSize={8}
            columns={[
              { key: "event_type", label: "Evento" },
              { key: "points_delta", label: "Cambio", render: (r) => <StatusBadge tone={Number(r.points_delta) >= 0 ? "success" : "warning"}>{Number(r.points_delta) >= 0 ? "+" : ""}{r.points_delta}</StatusBadge> },
              { key: "next_points", label: "Total" },
              { key: "reason", label: "Motivo" },
              { key: "created_at", label: "Fecha", render: (r) => shortDate(r.created_at) },
            ]}
            empty="Selecciona un usuario para ver historial."
          />
        </div>
      </div>
    </div>
  );
}


export default function AdminPanel() {
  const location = useLocation();
  const initialTab = location.pathname.split("/")[2] || "overview";
  const [activeTab, setActiveTab] = useState(tabs.some((t) => t.key === initialTab) ? initialTab : "overview");
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } }, []);

  const loadOverview = useCallback(async () => {
    setLoading(true); setError("");
    try { const res = await api.get("/admin/overview"); setOverview(res.data); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const section = location.pathname.split("/")[2] || "overview";
    setActiveTab(tabs.some((t) => t.key === section) ? section : "overview");
  }, [location.pathname]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  if (!user?.is_admin) {
    return <div className="page-stack"><div className="page-header-card"><div><span className="eyebrow">Acceso restringido</span><h2>Panel administrativo</h2><p>Tu sesión actual no tiene permisos de administrador. Si acabas de convertir tu usuario en admin, cierra sesión e inicia sesión nuevamente para actualizar el token local.</p></div></div></div>;
  }

  return (
    <div className="page-stack admin-page">
      <AdminHeader activeTab={activeTab} setActiveTab={setActiveTab} onRefresh={() => { loadOverview(); }} loading={loading} />
      {error && <div className="alert error">{error}</div>}
      {activeTab === "overview" && <OverviewPanel data={overview} />}
      {activeTab === "users" && <UsersPanel />}
      {activeTab === "tasks" && <TasksAdminPanel />}
      {activeTab === "deposits" && <DepositsPanel />}
      {activeTab === "withdrawals" && <WithdrawalsPanel />}
      {activeTab === "levels" && <LevelsPanel />}
      {activeTab === "support" && <SupportAdminPanel />}
      {activeTab === "prelaunch" && <PrelaunchAdminPanel />}
      {activeTab === "news" && <NewsAdminPanel />}
      {activeTab === "redeemCodes" && <RedeemCodesAdminPanel />}
      {activeTab === "roulette" && <RouletteAdminPanel />}
      {activeTab === "creditPoints" && <CreditPointsPanel />}
      {activeTab === "security" && <SecurityPanel />}
    </div>
  );
}

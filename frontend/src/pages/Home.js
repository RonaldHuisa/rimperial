import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiLock,
  FiMessageCircle,
  FiTrendingUp,
  FiZap,
} from "react-icons/fi";
import api from "../services/api";
import usdtIcon from "../assets/networks/usdt-bep20.png";
import recargaIcon from "../assets/icons/royal/recarga.png";
import retiroIcon from "../assets/icons/royal/retiro.png";
import garantiaIcon from "../assets/icons/royal/garantia.png";
import misionesIcon from "../assets/icons/royal/misiones.png";
import rendimientoIcon from "../assets/icons/royal/rendimiento.png";
import rachaIcon from "../assets/icons/royal/racha.png";
import planesIcon from "../assets/icons/royal/planes.png";
import historialIcon from "../assets/icons/royal/historial.png";
import soporteIcon from "../assets/icons/royal/soporte.png";
import { isRechargeLockedByPrelaunch, rechargePrelaunchMessage } from "../utils/prelaunchLock";

const money = (value) => `${Number(value || 0).toFixed(2)} USDT`;


function RoyalPanelIcon({ src, alt = "", className = "" }) {
  return <img className={`royal-panel-icon ${className}`.trim()} src={src} alt={alt} aria-hidden={alt ? undefined : "true"} loading="lazy" />;
}

function imageUrl(src) {
  if (!src) return "";
  if (src.startsWith("http") || src.startsWith("data:")) return src;
  if (src.startsWith("/")) return src;
  return `/${src}`;
}

export default function Home() {
  const navigate = useNavigate();
  const [vip, setVip] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [latestArticle, setLatestArticle] = useState(null);
  const [error, setError] = useState("");
  const [rechargeNotice, setRechargeNotice] = useState("");
  const [mobileSafe, setMobileSafe] = useState(() => typeof window !== "undefined" && window.innerWidth <= 760);
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  }, []);

  const load = async () => {
    try {
      const [vipRes, taskRes, newsRes] = await Promise.all([
        api.get("/vip/status"),
        api.get("/tasks/dashboard"),
        api.get("/news").catch(() => ({ data: { articles: [] } })),
      ]);
      setVip(vipRes.data);
      setTasks(taskRes.data);
      setLatestArticle((newsRes.data.articles || [])[0] || null);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const update = () => setMobileSafe(window.innerWidth <= 760);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!rechargeNotice) return undefined;
    const timer = setTimeout(() => setRechargeNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [rechargeNotice]);

  const handleRechargeClick = () => {
    if (isRechargeLockedByPrelaunch()) {
      setRechargeNotice(rechargePrelaunchMessage());
      return;
    }
    navigate("/recharge");
  };

  const referralId = user.referral_code || user.referralCode || user.id || "--";
  const guarantee = Number(vip?.user?.balance_usdt || 0);
  const withdrawable = Number(vip?.user?.withdrawable_usdt || 0);
  const completed = Number(tasks?.today?.completed || 0);
  const taskLimit = Number(tasks?.today?.limit || 0);
  const remaining = Math.max(0, Number(tasks?.today?.remaining ?? Math.max(0, taskLimit - completed)));
  const precision = Number(tasks?.accuracy?.weeklyPercent || 0).toFixed(0);
  const progressPct = taskLimit > 0 ? Math.min(100, Math.max(0, (completed / taskLimit) * 100)) : 0;
  const activePurchase = vip?.activePurchase;
  const activePlanPackage = (vip?.packages || []).find((item) => Number(item.level) === Number(activePurchase?.level));
  const planName = activePurchase ? `Plan ${activePlanPackage?.name || activePurchase.level}` : "Pasantía";
  const activityLabel = completed > 0 ? "Activa" : "Pendiente";

  if (mobileSafe) {
    return (
      <div className="page-stack home-safe-mobile">
        {rechargeNotice && (
          <div className="prelaunch-route-toast" role="status" aria-live="polite">
            <strong>Recargas habilitadas</strong>
            <small>{rechargeNotice}</small>
          </div>
        )}
        {error && <div className="alert error">{error}</div>}

        <section className="safe-welcome-card safe-welcome-ai-card">
          <div className="safe-welcome-copy">
            <span>Bienvenido ID {referralId}</span>
            <h2>Entrena la IA financiera de Royal Imperial</h2>
            <p>Completa tus tareas diarias, mejora tu precisión y revisa tu progreso.</p>
          </div>
          <img className="safe-welcome-brain" src="/ai-brain-banner.webp" alt="" aria-hidden="true" loading="eager" />
        </section>

        <section className="safe-balance-card">
          <div>
            <span>Saldo retirable</span>
            <strong>{withdrawable.toFixed(2)} <small>USDT</small></strong>
          </div>
          <div className="safe-usdt-badge">USDT</div>
        </section>

        <section className="safe-action-grid" aria-label="Accesos principales">
          <button type="button" onClick={handleRechargeClick}>
            <RoyalPanelIcon src={recargaIcon} />
            <span><strong>Recargar</strong><small>Disponible desde el lanzamiento</small></span>
          </button>
          <Link to="/withdraw">
            <RoyalPanelIcon src={retiroIcon} />
            <span><strong>Retirar</strong><small>Cobrar recompensa</small></span>
          </Link>
        </section>

        <section className="safe-metric-grid" aria-label="Resumen principal">
          <article>
            <RoyalPanelIcon src={garantiaIcon} />
            <span>Garantía activa</span>
            <strong>{guarantee.toFixed(2)} USDT</strong>
          </article>
          <article>
            <RoyalPanelIcon src={misionesIcon} />
            <span>Misiones IA de hoy</span>
            <strong>{completed} / {taskLimit}</strong>
            <small>{remaining} pendiente{remaining === 1 ? "" : "s"}</small>
          </article>
          <article>
            <RoyalPanelIcon src={rendimientoIcon} />
            <span>Rendimiento IA</span>
            <strong>{precision}%</strong>
            <small>Precisión semanal</small>
          </article>
          <article>
            <RoyalPanelIcon src={rachaIcon} />
            <span>Actividad diaria</span>
            <strong>{activityLabel}</strong>
            <small>{completed > 0 ? "Sigue completando tareas" : "Inicia tus tareas IA"}</small>
          </article>
        </section>

        <section className="safe-links-panel" aria-label="Accesos secundarios">
          <Link to="/levels"><RoyalPanelIcon src={planesIcon} /><span><strong>Planes</strong><small>Activa o mejora tu nivel</small></span><FiArrowRight /></Link>
          <Link to="/history"><RoyalPanelIcon src={historialIcon} /><span><strong>Movimientos</strong><small>Historial de cuenta</small></span><FiArrowRight /></Link>
          <Link to={latestArticle ? `/news/${latestArticle.slug}` : "/news"}><span className="safe-free-emoji" aria-hidden="true">📰</span><span><strong>Noticias</strong><small>{latestArticle?.title || "Novedades oficiales"}</small></span><FiArrowRight /></Link>
          <Link to="/support"><RoyalPanelIcon src={soporteIcon} /><span><strong>Centro de ayuda</strong><small>Soporte oficial</small></span><FiArrowRight /></Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack home-impact-v48">
      {rechargeNotice && (
        <div className="prelaunch-route-toast" role="status" aria-live="polite">
          <strong>Recargas habilitadas</strong>
          <small>{rechargeNotice}</small>
        </div>
      )}
      {error && <div className="alert error">{error}</div>}

      <section className="impact-ai-welcome-card">
        <div className="impact-ai-welcome-copy">
          <span>Bienvenido ID {referralId}</span>
          <h2>Entrena la IA financiera de Royal Imperial</h2>
          <p>Completa tus tareas diarias, mejora tu precisión y revisa tu progreso.</p>
        </div>
        <img src="/ai-brain-banner.webp" alt="" aria-hidden="true" />
      </section>

      <section className="home-impact-hero">
        <div className="impact-hero-copy">
          <span className="impact-eyebrow">Saldo retirable</span>
          <div className="impact-amount">
            <strong>{withdrawable.toFixed(2)}</strong>
            <span>USDT</span>
          </div>
        </div>

        <div className="impact-coin-scene" aria-hidden="true">
          <span className="impact-spark one" />
          <span className="impact-spark two" />
          <span className="impact-spark three" />
          <div className="impact-coin-ring">
            <div className="impact-usdt-coin">
              <img src={usdtIcon} alt="" />
            </div>
          </div>
          <div className="impact-podium"><span /></div>
        </div>
      </section>

      <section className="impact-action-grid" aria-label="Accesos principales">
        <button className="impact-action-card recharge impact-action-button" type="button" onClick={handleRechargeClick}>
          <span className="impact-action-icon"><RoyalPanelIcon src={recargaIcon} /></span>
          <div>
            <strong>Recargar</strong>
            <small>Disponible desde el lanzamiento</small>
          </div>
          <FiArrowRight className="impact-go" />
        </button>

        <Link className="impact-action-card withdraw" to="/withdraw">
          <span className="impact-action-icon"><RoyalPanelIcon src={retiroIcon} /></span>
          <div>
            <strong>Retirar</strong>
            <small>Cobrar recompensa</small>
          </div>
          <FiArrowRight className="impact-go" />
        </Link>
      </section>

      <section className="impact-metric-grid" aria-label="Resumen principal">
        <article className="impact-metric-card">
          <span className="impact-metric-icon shield"><RoyalPanelIcon src={garantiaIcon} /></span>
          <h3>Garantía activa</h3>
          <strong>{guarantee.toFixed(2)} USDT</strong>
          <small>Total disponible para niveles</small>
          <FiLock className="impact-watermark" />
        </article>

        <article className="impact-metric-card">
          <span className="impact-metric-icon tasks"><RoyalPanelIcon src={misionesIcon} /></span>
          <h3>Misiones IA de hoy</h3>
          <strong>{completed} / {taskLimit}</strong>
          <small>{remaining} pendiente{remaining === 1 ? "" : "s"}</small>
          <div className="impact-progress"><span style={{ width: `${progressPct}%` }} /></div>
        </article>

        <article className="impact-metric-card">
          <span className="impact-metric-icon target"><RoyalPanelIcon src={rendimientoIcon} /></span>
          <h3>Rendimiento IA</h3>
          <strong>{precision}%</strong>
          <small>Precisión semanal</small>
          <FiTrendingUp className="impact-line-art" />
        </article>

        <article className="impact-metric-card">
          <span className="impact-metric-icon activity"><RoyalPanelIcon src={rachaIcon} /></span>
          <h3>Actividad diaria</h3>
          <strong>{activityLabel}</strong>
          <small>{completed > 0 ? "Sigue completando tareas" : "Inicia tus tareas IA"}</small>
          <FiZap className="impact-watermark flame" />
        </article>
      </section>

      <section className="impact-links-panel" aria-label="Accesos secundarios">
        <Link to="/levels" className="impact-plan-link">
          <span><RoyalPanelIcon src={planesIcon} /></span>
          <div>
            <strong>Planes</strong>
            <small>Activa o mejora tu nivel</small>
          </div>
          <FiArrowRight />
        </Link>

        <Link to="/history">
          <span><RoyalPanelIcon src={historialIcon} /></span>
          <div>
            <strong>Movimientos</strong>
            <small>Historial de recargas, retiros y tareas</small>
          </div>
          <FiArrowRight />
        </Link>

        <Link to="/support">
          <span><RoyalPanelIcon src={soporteIcon} /></span>
          <div>
            <strong>Centro de ayuda</strong>
            <small>Soporte oficial verificado</small>
          </div>
          <em>5 - 15 min</em>
          <FiArrowRight />
        </Link>

      </section>

      <section className="impact-news-preview">
        <div className="impact-news-head">
          <div>
            <span>Novedades</span>
            <h3>Noticias Royal</h3>
          </div>
          <Link to="/news">Ver más <FiArrowRight /></Link>
        </div>

        <Link className="impact-news-card" to={latestArticle ? `/news/${latestArticle.slug}` : "/news"}>
          <span className="impact-news-thumb">
            {latestArticle?.coverImageUrl ? (
              <img src={imageUrl(latestArticle.coverImageUrl)} alt="" />
            ) : (
              <FiMessageCircle />
            )}
          </span>
          <div>
            <strong>{latestArticle?.title || "Sin noticias publicadas"}</strong>
            <small>{latestArticle?.summary || "Cuando haya novedades aparecerán en esta sección."}</small>
          </div>
          <FiArrowRight />
        </Link>
      </section>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiCheck, FiCreditCard, FiRefreshCw, FiShield, FiUserCheck } from 'react-icons/fi';
import api from '../services/api';
import checkinIcon from '../assets/icons/royal/checkin-calendar.png';
import weeklyTasksIcon from '../assets/icons/royal/weekly-fire-cup.png';
import clockIcon from '../assets/icons/royal/reloj.png';
import moneyIcon from '../assets/icons/royal/dolar.png';
import rouletteIcon from '../assets/icons/royal/ruleta.png';

function money(value) {
  return `${Number(value || 0).toFixed(2)} USDT`;
}

function balanceLabel(type) {
  return type === 'withdrawable' ? 'Saldo retirable' : 'Saldo garantía';
}

function Countdown({ resetAt }) {
  const [label, setLabel] = useState('00:00:00');

  useEffect(() => {
    if (!resetAt) {
      setLabel('Sin reinicio');
      return undefined;
    }

    const target = new Date(resetAt).getTime();
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setLabel('00:00:00');
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      setLabel(days > 0 ? `${days}d ${time}` : time);
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resetAt]);

  return <span>{label}</span>;
}

function NoticeToast({ message }) {
  if (!message) return null;
  return <div className="bonus-notice-toast">{message}</div>;
}

function CheckMarksRow({ days = [] }) {
  return (
    <div className="checkin-week-track" aria-label="Progreso de check-in">
      {days.map((day) => (
        <div key={day.day} className={`checkin-week-step ${day.done ? 'done' : ''}`}>
          <span className="checkin-step-mark">{day.done ? <FiCheck /> : day.day}</span>
          <small>Día {day.day}</small>
        </div>
      ))}
    </div>
  );
}

function RewardMini({ icon, alt, text }) {
  return (
    <span className="reward-mini-chip">
      <img src={icon} alt={alt} />
      <span>{text}</span>
    </span>
  );
}

export default function BonusCenter() {
  const location = useLocation();
  const isTasksPage = location.pathname.includes('/bonus/tasks');
  const isCheckinPage = !isTasksPage;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const showNotice = (message) => setNotice(message || '');

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/bonus/status');
      setData(res.data);
    } catch (err) {
      showNotice(err.message || 'No se pudo cargar la sección.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  const onCheckin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post('/bonus/checkin');
      if (res.data?.status) setData(res.data.status);
      showNotice(res.data.message || 'Check-in completado.');
    } catch (err) {
      showNotice(err.message || 'No se pudo registrar el check-in.');
      await load({ silent: true });
    } finally {
      setBusy(false);
    }
  };

  const onClaimTier = async (tierKey) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post('/bonus/tasks/claim', { tierKey });
      if (res.data?.status) setData(res.data.status);
      showNotice(res.data.message || 'Recompensa acreditada.');
    } catch (err) {
      showNotice(err.message || 'No se pudo reclamar la recompensa.');
      await load({ silent: true });
    } finally {
      setBusy(false);
    }
  };

  const checkin = data?.checkin || {};
  const tasks = data?.tasks || {};
  const isTrial = Boolean(data?.isTrial);
  const taskTiers = tasks?.tiers || [];
  const nextTier = taskTiers.find((tier) => !tier.claimed) || null;
  const validReferrals = Number(tasks.countedReferrals || 0);

  const checkinStatus = useMemo(() => {
    if (!data) return 'Cargando';
    if (checkin.todayDone) return 'Marcado hoy';
    if (checkin.canClaim) return 'Disponible';
    if (Number(checkin.completedThisWeek || 0) >= Number(checkin.maxDays || 0) && !isTrial) return 'Límite semanal';
    if (isTrial && Number(checkin.completedTotal || 0) >= Number(checkin.maxDays || 0)) return 'Finalizado';
    return 'No disponible';
  }, [data, checkin.todayDone, checkin.canClaim, checkin.completedThisWeek, checkin.completedTotal, checkin.maxDays, isTrial]);

  return (
    <div className="page-stack bonus-clean-page bonus-single-page">
      <NoticeToast message={notice} />

      {loading ? (
        <section className="bonus-section-panel"><p>Cargando bonos...</p></section>
      ) : (
        <>
          {isCheckinPage && (
            <section className="bonus-section-panel bonus-checkin-only">
              <div className="bonus-page-head compact-top">
                <div className="bonus-simple-title">
                  <img src={checkinIcon} alt="Check-in" />
                  <div>
                    <span className="bonus-section-eyebrow">CHECK-IN</span>
                    <h3>Check-in diario</h3>
                  </div>
                </div>
                <span className={`bonus-clean-status slim ${checkin.canClaim ? 'ready' : 'idle'}`}>{checkinStatus}</span>
              </div>

              <div className="bonus-simple-grid two-cols compact">
                <div className="bonus-clean-box">
                  <span>Recompensa</span>
                  <strong>{money(checkin.rewardUsdt)}</strong>
                  <small>{balanceLabel(checkin.balanceType)}</small>
                </div>
                <div className="bonus-clean-box align-right">
                  <span>Reset check-in</span>
                  <strong>{checkin.resetAt ? <Countdown resetAt={checkin.resetAt} /> : 'Sin reset'}</strong>
                  <small>{isTrial ? 'Disponible solo 5 veces' : 'Reinicio semanal'}</small>
                </div>
              </div>

              <div className="checkin-progress-header">
                <span>{isTrial ? 'Progreso total' : 'Progreso semanal'}</span>
                <strong>{isTrial ? `${checkin.completedTotal || 0}/${checkin.maxDays || 5}` : `${checkin.completedThisWeek || 0}/${checkin.maxDays || 5}`}</strong>
              </div>
              <CheckMarksRow days={checkin.days || []} />

              <div className="bonus-actions-row full compact-button-row">
                <button className="primary-btn bonus-clean-button compact" type="button" onClick={onCheckin} disabled={busy || !checkin.canClaim}>
                  {checkin.todayDone ? 'Marcado hoy' : 'Registrar check-in'}
                </button>
              </div>
            </section>
          )}

          {isTasksPage && (
            <section className="bonus-section-panel bonus-tasks-only tasks-premium-v8">
              <div className="tasks-clean-header">
                <div className="bonus-simple-title tasks-title-lockup compact">
                  <img src={weeklyTasksIcon} alt="Tareas" />
                  <div>
                    <span className="bonus-section-eyebrow">TAREAS SEMANALES</span>
                    <h3>Completa metas, gana premios</h3>
                  </div>
                </div>

                <div className="tasks-reset-card clean-reset-card">
                  <div className="clean-reset-top">
                    <img src={clockIcon} alt="Reloj" />
                    <span>Reset en</span>
                  </div>
                  <strong><Countdown resetAt={tasks.resetAt} /></strong>
                </div>
              </div>

              <div className="tasks-clean-summary">
                <div className="tasks-summary-item referrals">
                  <span>Referidos válidos</span>
                  <strong>{validReferrals}</strong>
                </div>
                <div className="tasks-summary-item summary-line">
                  <span>Siguiente meta</span>
                  <strong>{nextTier ? `${nextTier.required} referido${Number(nextTier.required) === 1 ? ' activo' : 's activos'}` : 'Todas las metas completadas'}</strong>
                  <small>{nextTier ? `Premio: ${money(nextTier.rewardUsdt)}${Number(nextTier.rewardRoulettePoints || 0) > 0 ? ` + ${nextTier.rewardRoulettePoints} ruletas` : ''}` : 'Has completado todas las metas de la semana.'}</small>
                </div>
              </div>

              <div className="weekly-task-list-clean premium-tier-list clean-list">
                {taskTiers.map((tier, index) => {
                  const percent = Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round(
                        (Number(tier.current || 0) /
                          Math.max(1, Number(tier.required || 1))) *
                          100
                      )
                    )
                  );
                  return (
                    <article
                      key={tier.key}
                      className={`clean-tier-card ${
                        tier.claimed ? 'is-claimed' : tier.canClaim ? 'is-ready' : ''
                      } ${percent >= 100 ? 'is-complete' : ''}`}
                    >
                      <div className="clean-tier-top">
                        <div className="clean-tier-copy">
                          <span className="bonus-section-eyebrow clean-tier-kicker">
                            Meta semanal {index + 1}
                          </span>
                          <h4 className="clean-tier-title">
                            {tier.required} referido
                            {tier.required === 1 ? ' activo' : 's activos'}
                          </h4>
                        </div>

                        <div className="weekly-reward-icons clean-rewards-right">
                          <RewardMini
                            icon={moneyIcon}
                            alt="Dinero"
                            text={money(tier.rewardUsdt)}
                          />
                          {Number(tier.rewardRoulettePoints || 0) > 0 && (
                            <RewardMini
                              icon={rouletteIcon}
                              alt="Ruleta"
                              text={`${tier.rewardRoulettePoints} ruletas`}
                            />
                          )}
                        </div>
                      </div>

                      <div className="mobile-task-progress-line">
                        <span className="clean-tier-progress-text">
                          {tier.current}/{tier.required} referidos válidos
                        </span>
                        <span
                          className={`clean-tier-percent ${percent >= 100 ? 'complete' : ''}`}
                          style={{ color: percent >= 100 ? '#278c50' : '#7a68ef' }}
                        >
                          {percent}%
                        </span>
                      </div>

                      <div className={`task-progress-bar subtle thin ${percent >= 100 ? 'complete' : ''}`}>
                        <div
                          className="task-progress-fill"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: percent >= 100 ? '#2fa35f' : '#7a68ef',
                          }}
                        />
                      </div>

                      <div className="mobile-task-action-row">
                        <button
                          type="button"
                          className={`secondary-btn bonus-clean-button compact clean-claim-button ${
                            tier.claimed ? 'done' : tier.canClaim ? 'ready' : ''
                          }`}
                          disabled={busy || !tier.canClaim}
                          onClick={() => onClaimTier(tier.key)}
                        >
                          {tier.claimed
                            ? 'Reclamado'
                            : tier.canClaim
                              ? 'Reclamar recompensa'
                              : 'Pendiente'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="premium-rules-panel">
                <div className="premium-rules-head">
                  <span className="bonus-section-eyebrow">CÓMO VALIDAR UN REFERIDO</span>
                  <strong>Debe cumplir estas condiciones</strong>
                </div>

                <div className="premium-rules-grid">
                  <article>
                    <FiUserCheck />
                    <div>
                      <strong>Datos personales</strong>
                      <span>Perfil completo y correctamente registrado.</span>
                    </div>
                  </article>
                  <article>
                    <FiCreditCard />
                    <div>
                      <strong>Cuenta de retiro</strong>
                      <span>Debe tener una cuenta de retiro registrada.</span>
                    </div>
                  </article>
                  <article>
                    <FiShield />
                    <div>
                      <strong>Plan activo</strong>
                      <span>Debe mantener un plan activo dentro de la plataforma.</span>
                    </div>
                  </article>
                  <article>
                    <FiRefreshCw />
                    <div>
                      <strong>Periodo semanal</strong>
                      <span>Las metas se reinician cada lunes a las 00:00 GMT-5.</span>
                    </div>
                  </article>
                </div>

                <p>
                  <strong>Las metas son acumulativas:</strong> cada referido válido
                  avanza todas las metas de la semana.
                </p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// Funções compartilhadas pelas telas de ranking, estatísticas e perfil.
const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.erro || `Erro ao carregar os dados (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function formatPercent(value) {
  const number = Number(value);
  return `${Number.isFinite(number) ? number.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  }) : '0'}%`;
}

function formatNumber(value) {
  return (Number(value) || 0).toLocaleString('pt-BR');
}

// O SQLite grava CURRENT_TIMESTAMP em UTC, sem fuso ("2026-11-09 14:20:00").
function parseDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('pt-BR') : '—';
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function levelFor(average, simulados) {
  if (!simulados) return 'Iniciante';
  if (average >= 85) return 'Avançado';
  if (average >= 70) return 'Intermediário';
  if (average >= 50) return 'Em evolução';
  return 'Iniciante';
}

// Metas ficam no navegador (por usuário); o padrão é 70% de média e 10 simulados.
function loadGoals(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`aprovaIF_metas_${userId}`) || 'null');
    if (saved && saved.media > 0 && saved.simulados > 0) return saved;
  } catch { /* usa o padrão */ }
  return { media: 70, simulados: 10 };
}

function saveGoals(userId, goals) {
  localStorage.setItem(`aprovaIF_metas_${userId}`, JSON.stringify(goals));
}

function clampPercent(value) {
  const number = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(number) ? number : 0));
}

// Preenche o cabeçalho: mostra "Meu Perfil" se houver sessão, senão Entrar/Criar conta.
async function renderHeaderActions() {
  const box = $('#headerActions');
  if (!box) return null;
  try {
    const me = await api('/api/me');
    box.innerHTML = '<a href="/perfil" class="btn btn-secondary">Meu Perfil</a><button type="button" class="btn btn-primary" id="logoutButton">Sair</button>';
    $('#logoutButton')?.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.reload();
    });
    return me;
  } catch {
    box.innerHTML = '<a href="/login" class="btn btn-primary">Entrar</a><a href="/cadastro" class="btn btn-secondary">Criar Conta</a>';
    return null;
  }
}

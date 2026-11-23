(() => {
'use strict';

const $ = (selector) => document.querySelector(selector);
const proofList = $('#proofList');
const listMessage = $('#listMessage');
const emptyState = $('#emptyState');
const examOverlay = $('#examOverlay');
let allProofs = [];
let activeProof = null;
let activeQuestions = [];
let submitting = false;
let currentUser = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function visitorId() {
  let id = localStorage.getItem('aprovaIF_visitanteId');
  if (!id) {
    id = (globalThis.crypto?.randomUUID?.() || `visitante-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem('aprovaIF_visitanteId', id);
  }
  return id;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.erro || `Erro na requisição (${response.status}).`);
  return data;
}

function labelType(type) {
  return ({ oficial: 'Prova oficial', simulado: 'Simulado', personalizada: 'Personalizada' })[String(type).toLowerCase()] || type || 'Prova';
}

function proofCard(proof) {
  const official = String(proof.tipo).toLowerCase() === 'oficial';
  const metadata = [proof.ano, proof.curso, proof.campus].filter(Boolean);
  const adminActions = currentUser?.isDev && !['simulado'].includes(String(proof.tipo).toLowerCase())
    ? `<div class="proof-admin-actions"><button class="btn btn-secondary edit-proof" type="button" data-proof-id="${Number(proof.id)}">Editar</button><button class="btn btn-danger delete-proof" type="button" data-proof-id="${Number(proof.id)}">Excluir</button></div>`
    : '';
  return `<article class="proof-card">
    <div class="proof-card-top"><div class="proof-icon" aria-hidden="true">${official ? '▤' : '✎'}</div><span class="type-pill ${official ? 'official' : ''}">${escapeHtml(labelType(proof.tipo))}</span></div>
    <h3>${escapeHtml(proof.titulo)}</h3>
    <div class="proof-details">${metadata.length ? metadata.map((item) => `<span>${escapeHtml(item)}</span>`).join('') : '<span>Banco de questões Aprova IF</span>'}</div>
    <div class="proof-card-bottom"><span class="question-count">${Number(proof.quantidade_questoes) || 0} questão(ões)</span><button class="btn btn-primary start-proof" type="button" data-proof-id="${Number(proof.id)}" ${Number(proof.quantidade_questoes) < 1 ? 'disabled title="Esta prova ainda não possui questões"' : ''}>Iniciar →</button></div>
    ${adminActions}
  </article>`;
}

function renderProofs() {
  const search = $('#search').value.trim().toLocaleLowerCase('pt-BR');
  const filtered = allProofs.filter((proof) => {
    const searchable = [proof.titulo, proof.curso, proof.campus, proof.ano, labelType(proof.tipo)].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
    return !search || searchable.includes(search);
  });
  proofList.innerHTML = filtered.map(proofCard).join('');
  $('#resultsCount').textContent = `${filtered.length} ${filtered.length === 1 ? 'prova encontrada' : 'provas encontradas'}`;
  $('#totalProvas').textContent = allProofs.length;
  emptyState.classList.toggle('hidden', filtered.length !== 0);
  proofList.classList.toggle('hidden', filtered.length === 0);
  proofList.querySelectorAll('.start-proof').forEach((button) => button.addEventListener('click', () => startProof(Number(button.dataset.proofId))));
  proofList.querySelectorAll('.edit-proof').forEach((button) => button.addEventListener('click', () => editProof(Number(button.dataset.proofId))));
  proofList.querySelectorAll('.delete-proof').forEach((button) => button.addEventListener('click', () => deleteProof(Number(button.dataset.proofId))));
}

async function loadProofs() {
  listMessage.textContent = 'Atualizando lista…';
  const params = new URLSearchParams();
  for (const [field, param] of [['filterTipo', 'tipo'], ['filterAno', 'ano'], ['filterCurso', 'curso'], ['filterCampus', 'campus']]) {
    const value = $(`#${field}`).value;
    if (value) params.set(param, value);
  }
  try {
    allProofs = await api(`/api/provas${params.size ? `?${params.toString()}` : ''}`);
    listMessage.textContent = '';
    renderProofs();
  } catch (error) {
    listMessage.textContent = error.message;
    proofList.innerHTML = '';
    emptyState.classList.remove('hidden');
  }
}

async function editProof(proofId) {
  const proof = allProofs.find((item) => Number(item.id) === proofId);
  if (!proof || !currentUser?.isDev) return;
  const titulo = prompt('Título da prova:', proof.titulo);
  if (titulo === null) return;
  if (!titulo.trim()) { alert('O título não pode ficar vazio.'); return; }
  const anoTexto = prompt('Ano da prova (deixe vazio se não houver):', proof.ano ?? '');
  if (anoTexto === null) return;
  if (anoTexto.trim() && !/^\\d{4}$/.test(anoTexto.trim())) {
    alert('Informe um ano com quatro dígitos ou deixe o campo vazio.');
    return;
  }
  const curso = prompt('Curso:', proof.curso ?? '');
  if (curso === null) return;
  const campus = prompt('Campus:', proof.campus ?? '');
  if (campus === null) return;
  try {
    await api(`/api/provas/${proofId}`, {
      method: 'PUT',
      body: JSON.stringify({
        titulo: titulo.trim(),
        ano: anoTexto.trim() ? Number(anoTexto) : null,
        curso: curso.trim() || null,
        campus: campus.trim() || null,
        tipo: proof.tipo
      })
    });
    await loadFilters();
    await loadProofs();
    listMessage.textContent = 'Prova atualizada com sucesso.';
  } catch (error) {
    alert(error.message || 'Não foi possível editar a prova.');
  }
}

async function deleteProof(proofId) {
  const proof = allProofs.find((item) => Number(item.id) === proofId);
  if (!proof || !currentUser?.isDev) return;
  if (!confirm(`Tem certeza de que deseja excluir "${proof.titulo}"? Os resultados vinculados a essa prova também serão apagados. Esta ação não pode ser desfeita.`)) return;
  try {
    await api(`/api/provas/${proofId}`, { method: 'DELETE' });
    await loadFilters();
    await loadProofs();
    listMessage.textContent = 'Prova excluída com sucesso.';
  } catch (error) {
    alert(error.message || 'Não foi possível excluir a prova.');
  }
}

function populateSelect(select, values, placeholder) {
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>` + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  if (values.map(String).includes(current)) select.value = current;
}

async function loadFilters() {
  const filters = await api('/api/provas/filtros');
  populateSelect($('#filterAno'), filters.anos || [], 'Todos os anos');
  populateSelect($('#filterCurso'), filters.cursos || [], 'Todos os cursos');
  populateSelect($('#filterCampus'), filters.campi || [], 'Todos os campi');
}

async function startProof(proofId) {
  listMessage.textContent = '';
  try {
    const [proof, questions] = await Promise.all([
      api(`/api/provas/${proofId}`),
      api(`/api/provas/${proofId}/questoes`)
    ]);
    if (!questions.length) throw new Error('Esta prova ainda não possui questões. Escolha outra prova ou gere um simulado.');
    activeProof = proof;
    activeQuestions = questions;
    $('#examTitle').textContent = proof.titulo;
    $('#examMeta').textContent = [labelType(proof.tipo), proof.ano, proof.curso, proof.campus, `${questions.length} questões`].filter(Boolean).join(' • ');
    $('#examResult').classList.add('hidden');
    $('#examForm').classList.remove('hidden');
    $('#submitExam').disabled = false;
    $('#submitExam').textContent = 'Finalizar e ver resultado';
    $('#questionList').innerHTML = questions.map((question, index) => `<section class="exam-question" data-question-id="${Number(question.id)}">
      <div class="question-label">Questão ${index + 1} · ${escapeHtml(question.materia || 'Geral')}${question.assunto ? ` · ${escapeHtml(question.assunto)}` : ''}</div>
      <h3>${escapeHtml(question.texto)}</h3>
      ${question.imagem ? `<img src="${escapeHtml(question.imagem)}" alt="Imagem da questão ${index + 1}" style="max-width:100%;margin-top:14px;border-radius:10px">` : ''}
      <div class="exam-options">${(question.alternativas || []).map((option) => `<label class="exam-option"><input type="radio" name="answer-${Number(question.id)}" value="${Number(option.id)}"><span><strong>${escapeHtml(option.letra)}.</strong> ${escapeHtml(option.texto)}</span></label>`).join('')}</div>
    </section>`).join('');
    $('#answerProgress').textContent = `0 de ${questions.length} respondidas`;
    $('#examProgress span').style.width = '0%';
    examOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    listMessage.textContent = error.message;
  }
}

function updateAnswerProgress() {
  const answered = activeQuestions.filter((question) => $(`#questionList input[name="answer-${question.id}"]:checked`)).length;
  $('#answerProgress').textContent = `${answered} de ${activeQuestions.length} respondidas`;
  $('#examProgress span').style.width = `${activeQuestions.length ? answered / activeQuestions.length * 100 : 0}%`;
}

async function submitExam(event) {
  event.preventDefault();
  if (!activeProof || submitting) return;
  const unanswered = activeQuestions.filter((question) => !$(`#questionList input[name="answer-${question.id}"]:checked`));
  if (unanswered.length && !confirm(`Você deixou ${unanswered.length} questão(ões) sem resposta. Deseja finalizar mesmo assim?`)) return;
  submitting = true;
  $('#submitExam').disabled = true;
  $('#submitExam').textContent = 'Calculando resultado…';
  const respostas = activeQuestions.map((question) => ({
    questaoId: Number(question.id),
    alternativaId: Number($(`#questionList input[name="answer-${question.id}"]:checked`)?.value) || null
  }));
  try {
    // Usuários autenticados salvam na própria conta; visitantes continuam
    // usando o histórico local identificado pelo visitanteId.
    const result = currentUser
      ? await api('/api/resultados', {
          method: 'POST',
          body: JSON.stringify({ provaId: Number(activeProof.id), respostas })
        })
      : await api('/api/resultados-visitantes', {
          method: 'POST',
          body: JSON.stringify({ visitanteId: visitorId(), provaId: Number(activeProof.id), respostas })
        });
    const totalQuestoes = activeQuestions.length;
    $('#examForm').classList.add('hidden');
    $('#examResult').classList.remove('hidden');
    $('#examResult').innerHTML = `<div class="result-score">${Number(result.nota).toLocaleString('pt-BR')}%</div><h3>${result.nota >= 70 ? 'Muito bem! Continue assim.' : 'Prática concluída!'}</h3><p>Você acertou <strong>${result.acertos}</strong> de <strong>${totalQuestoes}</strong> questões e errou ${result.erros}. ${currentUser ? 'Seu resultado foi salvo na sua conta.' : 'Seu resultado foi salvo no histórico deste navegador.'}</p><button type="button" class="btn btn-primary" id="backToProofs">Voltar para as provas</button>`;
    $('#backToProofs').addEventListener('click', closeExam);
    await loadHistory();
  } catch (error) {
    alert(error.message || 'Não foi possível salvar seu resultado.');
    $('#submitExam').disabled = false;
    $('#submitExam').textContent = 'Tentar finalizar novamente';
  } finally {
    submitting = false;
  }
}

function closeExam() {
  examOverlay.classList.add('hidden');
  document.body.style.overflow = '';
  activeProof = null;
  activeQuestions = [];
}

function formatDate(value) {
  if (!value) return 'Data indisponível';
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
}

async function loadHistory() {
  const target = $('#historyList');
  try {
    const history = currentUser
      ? await api(`/api/usuarios/${currentUser.id}/historico`)
      : await api(`/api/historico-visitante?visitanteId=${encodeURIComponent(visitorId())}`);
    if (!history.length) {
      target.innerHTML = '<div class="history-empty">Você ainda não concluiu nenhuma prova. Escolha uma prova acima para começar.</div>';
      return;
    }
    target.innerHTML = history.map((item) => `<article class="history-row"><div><h3>${escapeHtml(item.prova)}</h3><small>${escapeHtml(labelType(item.tipo))} · ${escapeHtml(formatDate(item.data_realizacao))}</small></div><div><small>Nota</small><div class="history-score">${Number(item.nota).toLocaleString('pt-BR')}%</div></div><div><small>Acertos</small><div>${Number(item.acertos)}</div></div><div><small>Erros</small><div>${Number(item.erros)}</div></div><div class="history-actions"><button class="btn btn-secondary retry-proof" type="button" data-proof-id="${Number(item.prova_id)}" data-title="${escapeHtml(item.prova)}" style="height:38px;padding:0 12px">Ver prova</button></div></article>`).join('');
    target.querySelectorAll('.retry-proof').forEach((button) => {
      button.addEventListener('click', () => startProof(Number(button.dataset.proofId)));
    });
  } catch (error) {
    target.innerHTML = `<div class="history-empty">Não foi possível carregar o histórico: ${escapeHtml(error.message)}</div>`;
  }
}

$('#search').addEventListener('input', renderProofs);
['filterTipo', 'filterAno', 'filterCurso', 'filterCampus'].forEach((id) => $(`#${id}`).addEventListener('change', loadProofs));
$('#clearFilters').addEventListener('click', () => {
  $('#search').value = '';
  ['filterTipo', 'filterAno', 'filterCurso', 'filterCampus'].forEach((id) => $(`#${id}`).value = '');
  loadProofs();
});
$('#customForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#customMessage');
  const button = $('#generateButton');
  message.textContent = '';
  button.disabled = true;
  button.textContent = 'Montando simulado…';
  try {
    const materias = [...document.querySelectorAll('input[name="materia"]:checked')].map((input) => input.value);
    const proof = await api('/api/simulados/personalizados', {
      method: 'POST',
      body: JSON.stringify({ materias, quantidade: Number($('#quantity').value), dificuldade: $('#difficulty').value ? Number($('#difficulty').value) : null })
    });
    await loadProofs();
    await startProof(Number(proof.id));
  } catch (error) {
    message.textContent = error.message || 'Não foi possível gerar o simulado.';
  } finally {
    button.disabled = false;
    button.innerHTML = 'Gerar meu simulado <span aria-hidden="true">→</span>';
  }
});
$('#examForm').addEventListener('change', updateAnswerProgress);
$('#examForm').addEventListener('submit', submitExam);
$('#closeExam').addEventListener('click', closeExam);
examOverlay.addEventListener('click', (event) => { if (event.target === examOverlay && !submitting) closeExam(); });
$('#refreshHistory').addEventListener('click', loadHistory);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !submitting && !examOverlay.classList.contains('hidden')) closeExam(); });

(async function init() {
  const createProofLink = $('#devCreateProof');
  createProofLink.hidden = true;
  createProofLink.style.display = 'none';
  try {
    currentUser = await api('/api/me');
    if (currentUser.isDev) {
      createProofLink.hidden = false;
      createProofLink.style.display = 'inline-flex';
    }
  } catch {
    currentUser = null;
  }
  if (!currentUser) {
    const customForm = $('#customForm');
    customForm.innerHTML = '<h3>Entre para gerar simulados privados</h3><p class="muted">Cada simulado criado fica visível somente na conta que o gerou.</p><a class="btn btn-primary full-btn" href="/login">Entrar na conta</a>';
  }
  await renderHeaderActions();
  try { await loadFilters(); } catch (error) { listMessage.textContent = error.message; }
  await Promise.all([loadProofs(), loadHistory()]);
})();
})();

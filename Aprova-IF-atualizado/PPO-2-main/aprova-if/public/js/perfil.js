let profile = null;

function renderProfile(data) {
  const { usuario, gerais = {}, ranking, historico = [] } = data;
  const media = Number(gerais.media_geral) || 0;
  const simulados = Number(gerais.simulados_realizados) || 0;
  const goals = loadGoals(usuario.id);

  $('#avatar').textContent = initials(usuario.nome);
  $('#profileName').textContent = usuario.nome;
  $('#profileEmail').textContent = usuario.email;
  $('#profileVisibility').textContent = usuario.compartilhar_estatisticas
    ? 'Suas estatísticas são públicas no ranking.'
    : 'Suas estatísticas são privadas.';

  $('#pSimulados').textContent = formatNumber(simulados);
  $('#pMedia').textContent = formatPercent(media);
  $('#pRanking').textContent = ranking ? `#${ranking}` : '—';
  $('#pQuestoes').textContent = formatNumber(gerais.questoes_respondidas);

  $('#infoName').textContent = usuario.nome;
  $('#infoEmail').textContent = usuario.email;
  $('#infoCreated').textContent = formatDate(usuario.data_criacao);
  $('#infoLevel').textContent = levelFor(media, simulados);

  $('#goalSimText').textContent = `${formatNumber(simulados)} de ${goals.simulados} simulados`;
  $('#goalSimFill').style.width = `${clampPercent((simulados / goals.simulados) * 100)}%`;
  $('#goalMediaText').textContent = `Média ${formatPercent(media)} (meta ${goals.media}%)`;
  $('#goalMediaFill').style.width = `${clampPercent((media / goals.media) * 100)}%`;

  const table = $('#historyTable');
  table.innerHTML = historico.length
    ? historico.slice(0, 5).map(item => `
        <div class="history-row">
          <span>${escapeHtml(item.prova)}</span>
          <span>${formatPercent(item.nota)}</span>
          <span>${formatDate(item.data_realizacao)}</span>
        </div>`).join('')
    : '<p class="history-empty">Nenhum simulado realizado ainda. <a href="/simulados">Fazer um simulado</a>.</p>';
}

function openEditor(open) {
  $('#editSection').hidden = !open;
  if (!open) return;
  const goals = loadGoals(profile.usuario.id);
  $('#editName').value = profile.usuario.nome;
  $('#editShare').checked = !!profile.usuario.compartilhar_estatisticas;
  $('#goalMedia').value = goals.media;
  $('#goalSimulados').value = goals.simulados;
  $('#editMessage').textContent = '';
  $('#editMessage').className = 'edit-message';
  $('#editName').focus();
}

async function saveProfile(event) {
  event.preventDefault();
  const message = $('#editMessage');
  const nome = $('#editName').value.trim();
  const media = Number($('#goalMedia').value);
  const simulados = Number($('#goalSimulados').value);

  message.className = 'edit-message error';
  if (nome.length < 2 || nome.length > 100) {
    message.textContent = 'O nome deve ter entre 2 e 100 caracteres.';
    return;
  }
  if (!(media >= 1 && media <= 100) || !Number.isInteger(simulados) || simulados < 1 || simulados > 1000) {
    message.textContent = 'Informe uma meta de média entre 1 e 100 e um número inteiro de simulados.';
    return;
  }

  const button = $('#btnSave');
  button.disabled = true;
  try {
    await api('/api/usuarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, compartilharEstatisticas: $('#editShare').checked })
    });
    saveGoals(profile.usuario.id, { media, simulados });

    // Mantém o nome do localStorage (usado por outras telas) em sincronia.
    try {
      const saved = JSON.parse(localStorage.getItem('usuario') || 'null');
      if (saved) localStorage.setItem('usuario', JSON.stringify({ ...saved, nome }));
    } catch { /* ignora */ }

    // Recarrega do servidor: a posição no ranking muda ao ativar/desativar o compartilhamento.
    profile = await api('/api/perfil');
    renderProfile(profile);
    message.className = 'edit-message success';
    message.textContent = 'Perfil atualizado!';
    setTimeout(() => openEditor(false), 700);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function logout() {
  try { await api('/api/logout', { method: 'POST' }); } catch { /* segue para sair */ }
  localStorage.removeItem('usuario');
  window.location.href = '/login';
}

async function initProfile() {
  const message = $('#profileMessage');
  const me = await renderHeaderActions();

  if (!me) {
    message.innerHTML = 'Faça <a href="/login">login</a> para acessar o seu perfil.';
    return;
  }

  try {
    profile = await api('/api/perfil');
    renderProfile(profile);
    message.hidden = true;
    $('#profileContent').hidden = false;

    $('#btnEdit').addEventListener('click', () => openEditor(true));
    $('#btnCancel').addEventListener('click', () => openEditor(false));
    $('#editForm').addEventListener('submit', saveProfile);
    $('#btnLogout').addEventListener('click', logout);
  } catch (error) {
    message.textContent = `Não foi possível carregar o perfil: ${error.message}`;
  }
}

initProfile();

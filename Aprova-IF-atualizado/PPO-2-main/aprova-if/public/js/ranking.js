function renderPodium(ranking) {
  const podium = $('#podium');
  const positions = [
    { item: ranking[1], className: 'second', medal: '🥈', position: 2 },
    { item: ranking[0], className: 'first', medal: '🥇', position: 1 },
    { item: ranking[2], className: 'third', medal: '🥉', position: 3 }
  ].filter(entry => entry.item);

  if (!positions.length) {
    podium.innerHTML = '<p class="ranking-empty">Ainda não há participantes suficientes para formar o pódio.</p>';
    return;
  }

  podium.innerHTML = positions.map(({ item, className, medal, position }) => `
    <article class="podium-card ${className}">
      <span class="medal" aria-label="${position}º lugar">${medal}</span>
      <h3>${escapeHtml(item.nome)}</h3>
      <p>${formatPercent(item.media)}</p>
      <small>${Number(item.simulados) || 0} simulado(s)</small>
    </article>
  `).join('');
}

function renderRanking(ranking, me) {
  const list = $('#rankingList');

  if (!ranking.length) {
    list.innerHTML = '<p class="ranking-empty">Ainda não há resultados compartilhados para exibir. Ative o compartilhamento de estatísticas no perfil para participar do ranking.</p>';
    $('#podium').innerHTML = '';
    return;
  }

  list.innerHTML = ranking.map((item, index) => `
    <div class="table-row${me && item.id === me.id ? ' me' : ''}">
      <span>#${index + 1}</span>
      <span>${escapeHtml(item.nome)}${me && item.id === me.id ? ' <em>(você)</em>' : ''}</span>
      <span>${formatPercent(item.media)}</span>
    </div>
  `).join('');

  renderPodium(ranking);
}

function renderSubjects(subjects) {
  const grid = $('#subjectsGrid');

  if (!subjects.length) {
    grid.innerHTML = '<p class="ranking-empty">Ainda não há desempenhos por disciplina compartilhados.</p>';
    return;
  }

  // A API já ordena por matéria e percentual decrescente.
  const bestBySubject = new Map();
  for (const item of subjects) {
    const key = String(item.materia || 'Geral');
    if (!bestBySubject.has(key)) bestBySubject.set(key, item);
  }

  grid.innerHTML = [...bestBySubject.values()].map(item => `
    <article class="subject-card">
      <h3>${escapeHtml(item.materia || 'Geral')}</h3>
      <p><strong>${escapeHtml(item.nome)}</strong> — ${formatPercent(item.percentual)}</p>
      <small>${Number(item.acertos) || 0} de ${Number(item.total) || 0} questões corretas</small>
    </article>
  `).join('');
}

async function initRanking() {
  const message = $('#rankingMessage');

  try {
    const [ranking, subjects, me] = await Promise.all([
      api('/api/ranking'),
      api('/api/materias'),
      renderHeaderActions()
    ]);

    renderRanking(Array.isArray(ranking) ? ranking : [], me);
    renderSubjects(Array.isArray(subjects) ? subjects : []);
    const position = me ? ranking.findIndex(item => item.id === me.id) + 1 : 0;
    message.textContent = !ranking.length
      ? 'O ranking ainda não possui participantes.'
      : position
        ? `Você está em ${position}º lugar entre ${ranking.length} participante(s).`
        : `Ranking atualizado: ${ranking.length} participante(s).${me ? ' Ative o compartilhamento no perfil para aparecer aqui.' : ''}`;
  } catch (error) {
    message.textContent = `Não foi possível carregar o ranking: ${error.message}`;
    $('#podium').innerHTML = '';
    $('#rankingList').innerHTML = '<p class="ranking-empty">Tente atualizar a página.</p>';
    $('#subjectsGrid').innerHTML = '<p class="ranking-empty">Não foi possível carregar os desempenhos.</p>';
  }
}

initRanking();

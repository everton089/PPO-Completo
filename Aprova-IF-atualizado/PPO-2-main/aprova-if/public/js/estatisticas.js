const charts = {};

function drawChart(id, config) {
  if (typeof Chart === 'undefined') return; // Chart.js não carregou (sem internet)
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}

function renderOverview(data) {
  const g = data.gerais || {};
  $('#statSimulados').textContent = formatNumber(g.simulados_realizados);
  $('#statMedia').textContent = formatPercent(g.media_geral);
  $('#statQuestoes').textContent = formatNumber(g.questoes_respondidas);

  if (data.ranking) {
    $('#statRanking').textContent = `#${data.ranking}`;
    $('#statRankingNote').textContent = '';
  } else {
    $('#statRanking').textContent = '—';
    $('#statRankingNote').innerHTML = 'Ative o compartilhamento no <a href="/perfil">perfil</a> para entrar no ranking.';
  }
}

function renderInsights(data) {
  const evolucao = data.evolucao || [];
  const materias = data.materias || [];

  if (evolucao.length) {
    const melhor = evolucao.reduce((a, b) => (Number(b.nota) > Number(a.nota) ? b : a));
    const ultimo = evolucao[evolucao.length - 1];
    $('#statMelhor').textContent = `${formatPercent(melhor.nota)} — ${melhor.prova}`;
    $('#statUltimo').textContent = `${formatPercent(ultimo.nota)} — ${ultimo.prova}`;
  }

  if (materias.length) {
    // A API já ordena por percentual decrescente.
    const forte = materias[0];
    const fraco = materias[materias.length - 1];
    $('#statForte').textContent = `${forte.materia} (${formatPercent(forte.percentual)})`;
    $('#statFraco').textContent = materias.length > 1
      ? `${fraco.materia} (${formatPercent(fraco.percentual)})`
      : 'Responda mais matérias para comparar';
  }
}

function renderCharts(data) {
  const evolucao = data.evolucao || [];
  const materias = data.materias || [];
  const g = data.gerais || {};

  drawChart('progressChart', {
    type: 'line',
    data: {
      labels: evolucao.map((item, i) => `${i + 1}. ${item.prova}`),
      datasets: [{
        label: 'Nota (%)',
        data: evolucao.map(item => Number(item.nota)),
        tension: 0.3,
        borderWidth: 3,
        borderColor: '#006b3f',
        backgroundColor: 'rgba(0,107,63,.15)',
        fill: true
      }]
    },
    options: { scales: { y: { min: 0, max: 100 } } }
  });

  const hasSubjects = materias.length > 0;
  $('#subjectChart').hidden = !hasSubjects;
  $('#subjectEmpty').hidden = hasSubjects;
  if (hasSubjects) {
    drawChart('subjectChart', {
      type: 'bar',
      data: {
        labels: materias.map(item => item.materia),
        datasets: [{
          label: 'Acertos (%)',
          data: materias.map(item => Number(item.percentual)),
          backgroundColor: '#006b3f'
        }]
      },
      options: { scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
    });
  }

  drawChart('pieChart', {
    type: 'doughnut',
    data: {
      labels: ['Acertos', 'Erros'],
      datasets: [{
        data: [Number(g.acertos) || 0, Number(g.erros) || 0],
        backgroundColor: ['#006b3f', '#d9534f']
      }]
    }
  });
}

function renderGoal(data, userId) {
  const goals = loadGoals(userId);
  const g = data.gerais || {};
  const mediaPct = clampPercent((Number(g.media_geral) / goals.media) * 100);
  const simPct = clampPercent((Number(g.simulados_realizados) / goals.simulados) * 100);
  // A meta combina a média alvo e o número de simulados, com o mesmo peso.
  const total = Math.round((mediaPct + simPct) / 2);

  $('#goalText').textContent =
    `Meta: média de ${goals.media}% em ${goals.simulados} simulados. ` +
    `Você está com ${formatPercent(g.media_geral)} em ${formatNumber(g.simulados_realizados)} simulado(s).`;
  $('#goalFill').style.width = `${total}%`;
  $('#goalPercent').textContent = `${total}% da meta concluída`;
}

function renderHistory(data) {
  const table = $('#historyTable');
  const historico = (data.historico || []).slice(0, 8);

  if (!historico.length) {
    table.innerHTML = '<p class="history-empty">Você ainda não fez nenhum simulado. <a href="/simulados">Comece agora</a>.</p>';
    return;
  }

  table.innerHTML = historico.map(item => `
    <div class="history-row">
      <span>${escapeHtml(item.prova)}</span>
      <span>${formatPercent(item.nota)}</span>
      <span>${formatDate(item.data_realizacao)}</span>
    </div>
  `).join('');
}

async function initStats() {
  const message = $('#statsMessage');
  const me = await renderHeaderActions();

  if (!me) {
    message.innerHTML = 'Faça <a href="/login">login</a> para ver as suas estatísticas.';
    return;
  }

  try {
    const data = await api('/api/perfil');
    renderOverview(data);
    renderInsights(data);
    renderCharts(data);
    renderGoal(data, me.id);
    renderHistory(data);

    const vazio = !(data.gerais && data.gerais.simulados_realizados);
    message.hidden = !vazio;
    message.innerHTML = vazio
      ? 'Você ainda não fez nenhum simulado. <a href="/simulados">Faça o primeiro</a> para ver seus gráficos.'
      : '';
    $('#statsContent').hidden = false;
  } catch (error) {
    message.textContent = `Não foi possível carregar as estatísticas: ${error.message}`;
  }
}

initStats();

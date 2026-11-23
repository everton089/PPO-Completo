(async function () {
  const number = value => Number(value || 0).toLocaleString('pt-BR');
  const percent = value => `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  try {
    const response = await fetch('/api/estatisticas-publicas');
    if (!response.ok) throw new Error('Não foi possível carregar os indicadores.');
    const stats = await response.json();
    document.getElementById('statProvas').textContent = number(stats.provas);
    document.getElementById('statUsuarios').textContent = number(stats.usuarios);
    document.getElementById('statQuestoes').textContent = number(stats.questoes);
    document.getElementById('statMedia').textContent = percent(stats.mediaGeral);
    document.getElementById('statRespondidas').textContent = number(stats.questoesRespondidas);
  } catch {
    ['statProvas', 'statUsuarios', 'statQuestoes', 'statMedia', 'statRespondidas'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
  }
  const user = await renderHeaderActions();
  if (user) {
    const start = document.getElementById('heroStart');
    if (start) { start.href = '/perfil'; start.textContent = 'Meu perfil'; }
  }
})();

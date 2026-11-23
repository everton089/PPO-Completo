const form = document.getElementById('provaForm');
const questions = document.getElementById('questions');
const typeSelect = document.getElementById('tipo');
const message = document.getElementById('message');
const saveButton = document.getElementById('saveButton');
let questionCount = 0;

(async () => {
  try {
    const response = await fetch('/api/me');
    const user = await response.json();
    if (!response.ok || !user.isDev) window.location.replace('/');
  } catch {
    window.location.replace('/');
  }
})();

// Gera rótulos em sequência: A...Z, AA, AB... sem limite fixo de alternativas.
function letterForIndex(index) {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value--;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function renumberAlternatives(section) {
  const rows = [...section.querySelectorAll('.answer')];
  rows.forEach((row, index) => {
    const letter = letterForIndex(index);
    const questionNumber = section.dataset.question;
    row.querySelector('.answer-letter').textContent = `Alternativa ${letter}`;
    row.querySelector('.answer-text').dataset.letter = letter;
    const radio = row.querySelector('input[type="radio"]');
    radio.name = `correct-${questionNumber}`;
    radio.value = letter;
    radio.setAttribute('aria-label', `Alternativa ${letter} correta`);
  });
  if (rows.length && !section.querySelector('input[type="radio"]:checked')) {
    rows[0].querySelector('input[type="radio"]').checked = true;
  }
}

function addAlternative(section) {
  const container = section.querySelector('.answers-list');
  const index = container.children.length;
  const letter = letterForIndex(index);
  const questionNumber = section.dataset.question;
  const row = document.createElement('div');
  row.className = 'answer';
  row.innerHTML = `
    <div class="form-group">
      <label class="answer-letter">Alternativa ${letter}</label>
      <input class="answer-text" data-letter="${letter}" required maxlength="2000" placeholder="Texto da alternativa">
    </div>
    <div class="answer-controls">
      <label class="correct-label">
        <input type="radio" name="correct-${questionNumber}" value="${letter}" ${index === 0 ? 'checked' : ''} required>
        Correta
      </label>
      <button type="button" class="btn btn-secondary remove-answer" aria-label="Remover alternativa ${letter}">Remover</button>
    </div>`;

  row.querySelector('.remove-answer').addEventListener('click', () => {
    if (container.children.length <= 2) {
      message.className = 'message error';
      message.textContent = 'Cada questão precisa ter pelo menos duas alternativas.';
      return;
    }
    row.remove();
    renumberAlternatives(section);
    message.textContent = '';
    message.className = '';
  });

  container.appendChild(row);
  renumberAlternatives(section);
}

function addQuestion() {
  questionCount++;
  const number = questionCount;
  const section = document.createElement('section');
  section.className = 'question';
  section.dataset.question = String(number);
  section.innerHTML = `
    <h3>Questão ${number}</h3>
    <div class="grid">
      <div class="form-group"><label>Matéria *</label><select class="subject" required><option value="">Selecione</option><option>Matemática</option><option>Português</option><option>História</option><option>Geografia</option><option>Ciências</option><option>Física</option><option>Química</option><option>Biologia</option><option>Outra</option></select></div>
      <div class="form-group"><label>Assunto</label><input class="topic" maxlength="120" placeholder="Assunto da questão"></div>
      <div class="form-group"><label>Dificuldade</label><select class="difficulty"><option value="1">Fácil</option><option value="2" selected>Média</option><option value="3">Difícil</option></select></div>
    </div>
    <div class="form-group"><label>Enunciado *</label><textarea class="statement" required maxlength="10000" placeholder="Digite o enunciado"></textarea></div>
    <div class="form-group"><label>Imagem da questão (opcional)</label><input class="question-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><p class="hint">PNG, JPG, WEBP ou GIF. Tamanho máximo: 5 MB.</p><img class="question-image-preview" alt="Prévia da imagem da questão"></div>
    <div class="alternatives-heading"><h4>Alternativas (marque a correta)</h4><p class="hint">Comece com cinco alternativas ou adicione quantas precisar. Não há limite máximo.</p></div>
    <div class="answers-list"></div>
    <div class="question-actions">
      <button type="button" class="btn btn-secondary add-answer">+ Adicionar alternativa</button>
      <button type="button" class="btn btn-secondary remove-question">Remover questão</button>
    </div>`;

  const imageInput = section.querySelector('.question-image');
  const preview = section.querySelector('.question-image-preview');
  let previewUrl = null;
  imageInput.addEventListener('change', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = imageInput.files?.[0];
    if (!file) {
      preview.removeAttribute('src');
      preview.style.display = 'none';
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      imageInput.value = '';
      preview.removeAttribute('src');
      preview.style.display = 'none';
      message.className = 'message error';
      message.textContent = 'Escolha uma imagem PNG, JPG, WEBP ou GIF de até 5 MB.';
      return;
    }
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.style.display = 'block';
    message.textContent = '';
    message.className = '';
  });

  section.querySelector('.add-answer').addEventListener('click', () => addAlternative(section));
  section.querySelector('.remove-question').addEventListener('click', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    section.remove();
  });

  questions.appendChild(section);
  // Cinco opções iniciais, mas o usuário pode acrescentar quantas quiser.
  for (let i = 0; i < 5; i++) addAlternative(section);
}

document.getElementById('addQuestion').addEventListener('click', addQuestion);
addQuestion();

async function api(url, body) {
  const response = await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.erro || `Falha na requisição (${response.status}).`);
  return data;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.className = '';
  message.textContent = '';
  const questionNodes = [...questions.querySelectorAll('.question')];
  if (!questionNodes.length) {
    message.className = 'message error';
    message.textContent = 'Adicione pelo menos uma questão.';
    return;
  }

  for (const node of questionNodes) {
    const alternatives = [...node.querySelectorAll('.answer')];
    if (alternatives.length < 2) {
      message.className = 'message error';
      message.textContent = `A questão ${node.dataset.question} precisa ter pelo menos duas alternativas.`;
      return;
    }
    if (!node.querySelector(`input[name="correct-${node.dataset.question}"]:checked`)) {
      message.className = 'message error';
      message.textContent = `Marque a alternativa correta da questão ${node.dataset.question}.`;
      return;
    }
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Salvando...';
  try {
    const proof = await api('/api/provas', {
      titulo: document.getElementById('titulo').value.trim(),
      ano: document.getElementById('ano').value ? Number(document.getElementById('ano').value) : null,
      curso: document.getElementById('curso').value.trim() || null,
      campus: document.getElementById('campus').value.trim() || null,
      tipo: typeSelect.value
    });

    for (let index = 0; index < questionNodes.length; index++) {
      const node = questionNodes[index];
      let imagem = null;
      const imageFile = node.querySelector('.question-image').files?.[0];
      if (imageFile) {
        const upload = new FormData();
        upload.append('imagem', imageFile);
        const uploadResponse = await fetch('/api/imagens-questao', { method: 'POST', body: upload });
        const uploadData = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) throw new Error(uploadData.erro || `Falha ao enviar imagem (${uploadResponse.status}).`);
        imagem = uploadData.url;
      }

      const q = await api('/api/questoes', {
        materia: node.querySelector('.subject').value,
        assunto: node.querySelector('.topic').value.trim() || null,
        texto: node.querySelector('.statement').value.trim(),
        dificuldade: Number(node.querySelector('.difficulty').value),
        tipo: 'multipla escolha',
        imagem
      });

      const alternativeNodes = [...node.querySelectorAll('.answer')];
      for (let optionIndex = 0; optionIndex < alternativeNodes.length; optionIndex++) {
        const option = alternativeNodes[optionIndex];
        await api(`/api/questoes/${q.id}/alternativas`, {
          letra: letterForIndex(optionIndex),
          texto: option.querySelector('.answer-text').value.trim(),
          correta: option.querySelector('input[type="radio"]').checked
        });
      }
      await api(`/api/provas/${proof.id}/questoes`, { questaoId: q.id, ordem: index + 1 });
    }

    message.className = 'message success';
    message.textContent = `Prova "${proof.titulo}" cadastrada com ${questionNodes.length} questão(ões)!`;
    form.reset();
    questions.innerHTML = '';
    questionCount = 0;
    addQuestion();
  } catch (error) {
    message.className = 'message error';
    message.textContent = error.message || 'Não foi possível cadastrar a prova.';
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Salvar prova';
  }
});

# Aprova IF

Aplicação web de simulados para preparação para o ingresso no Instituto Federal Catarinense (IFC).

## Requisitos

- [Bun](https://bun.sh/) instalado.
- Node não é necessário para executar o servidor; o projeto usa `bun:sqlite` e `Bun.password`.

## Como executar

Na pasta raiz do projeto:

```bash
bun install
bun run dev
se nao funcionar o bun run dev, use bun run server.ts

```

Abra http://localhost:3000 no navegador. As páginas de cadastro e login ficam em `/cadastro` e `/login`.

## Cadastro e login

- Cadastro exige nome, e-mail válido e senha com pelo menos 8 caracteres.
- Senhas são armazenadas como hash usando `Bun.password.hash` e verificadas com `Bun.password.verify`.
- O login cria uma sessão no servidor e usa cookie `HttpOnly`, `SameSite=Lax` e `Secure` quando servido por HTTPS.
- A autorização é validada no servidor; identificadores enviados pelo navegador não definem o usuário autenticado.

## Banco de dados

O SQLite é criado/lido em `database.sqlite`, na raiz do projeto.


## Área de desenvolvimento e cadastro de provas

O cadastro de provas e questões fica em `/cadastrar-prova` e é exclusivo da conta de desenvolvimento.

1. Crie uma conta normal no Aprova IF.
2. Na raiz do projeto, configure `ADMIN_EMAIL` no arquivo `.env` com o e-mail exato dessa conta, por exemplo `ADMIN_EMAIL=admin@exemplo.com`.
3. Reinicie o servidor (`bun run dev`) e entre com essa conta.
4. A conta configurada terá acesso à tela de cadastro e aos endpoints de criação de provas, questões, alternativas e upload de imagens.

A autorização é verificada pela sessão no servidor. Não basta alterar o HTML, enviar um `criadorId` manualmente ou chamar diretamente a API.

## Tela de Provas

A página de provas fica em `http://localhost:3000/simulados`. Provas oficiais e provas cadastradas pela equipe ficam disponíveis publicamente. Simulados gerados pelo banco de questões exigem login e ficam visíveis apenas para a conta que os gerou.

- O cadastro de prova aceita os campos opcionais `curso` e `campus`.
- A criação de simulado personalizado seleciona questões existentes no banco por matéria e dificuldade. O servidor associa o simulado ao usuário autenticado, sem confiar em um ID enviado pelo navegador.
- Os resultados de usuários autenticados ficam associados à conta. O histórico local de visitantes continua disponível para provas públicas.
- Ao iniciar uma versão anterior do banco, o servidor adiciona as colunas `curso` e `campus` automaticamente, sem remover as provas já existentes.


### Imagens nas questões

No cadastro de provas, cada questão pode incluir uma imagem PNG, JPG, WEBP ou GIF de até 5 MB. A imagem é enviada ao servidor e guardada em `aprova-if/public/assets/images/questions/`; o caminho é salvo no SQLite e a imagem aparece automaticamente ao responder à prova. Mantenha essa pasta ao fazer cópias de segurança do projeto.

## Indicadores da página inicial

Os números da página inicial são consultados em tempo real no endpoint `/api/estatisticas-publicas` e vêm do SQLite: usuários cadastrados, provas, questões no banco, questões respondidas e média das tentativas registradas. Quando não há dados, o site mostra zero em vez de números fictícios.


## Conta de desenvolvimento / administração

O acesso ao cadastro, edição e exclusão de provas e ao banco de questões é controlado no servidor pelo e-mail autenticado.

1. Copie `.env.example` para `.env`.
2. Configure `ADMIN_EMAILS` com o e-mail exato da conta administrativa (pode informar vários, separados por vírgula).
3. Reinicie o servidor com `bun run dev`.

O banco incluído neste pacote já contém a conta `admin@exemplo.com`; por isso esse endereço é o padrão apenas para facilitar o ambiente local. **Antes de publicar o sistema, substitua-o pelo e-mail real da equipe e não mantenha o endereço de exemplo.**

Provas do tipo `oficial` são públicas. Simulados gerados a partir do banco de questões são privados e só podem ser listados, abertos e respondidos pela conta que os gerou. Administradores podem editar os metadados e excluir provas oficiais/personalizadas; ao excluir uma prova, os resultados associados também são removidos.


## Prova oficial IFC 2026.1

O banco incluído já contém o **Exame de Classificação IFC 2026.1 – Cursos Técnicos Integrados**, com 28 questões, cinco alternativas por questão, gabarito definitivo e imagens de apoio extraídas do caderno de prova. A rotina `seedProvaIFC2026` também verifica essa prova na inicialização e a cadastra automaticamente em bancos novos, sem criar duplicatas ao reiniciar o servidor.

## Alternativas sem limite fixo

O cadastro de questões começa com cinco alternativas, mas permite adicionar ou remover alternativas livremente (mantendo pelo menos duas). Os rótulos seguem a sequência A–Z, AA, AB e assim por diante. A listagem no simulador mantém a ordem em que as alternativas foram cadastradas.

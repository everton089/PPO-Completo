# Aprova IF

Sistema de simulados desenvolvido com **Bun, TypeScript, SQLite, HTML, CSS e JavaScript**, com cadastro de provas e questões, realização de simulados, correção automática, resultados, estatísticas e ranking.

## 1. Requisitos

Antes de executar o projeto, é necessário instalar:

- **Bun:** ambiente de execução utilizado pelo projeto.

  
Não é necessário instalar o SQLite separadamente. Ele é utilizado pelo próprio projeto como banco de dados integrado.

## 2. Instalação do Bun

Acesse o site oficial e siga as instruções de instalação:

https://bun.sh/

Após instalar, abra o terminal e verifique se está funcionando:

```bash
bun --version
```

## 3. Baixar o projeto

extraia o arquivo ZIP do projeto.

Abra o terminal na pasta que contém o arquivo `package.json`.

## 4. Instalar as dependências

Execute:

```bash
bun install
```

Esse comando instala as dependências necessárias para executar o sistema.

## 5. Configurar o administrador

Na pasta principal do projeto, crie um arquivo chamado `.env`.

Adicione:

```env
ADMIN_EMAIL=admin@exemplo.com
```

Substitua o endereço pelo e-mail da conta que terá permissões administrativas.

A conta deverá estar cadastrada no sistema com esse mesmo e-mail.

## 6. Banco de dados

O projeto utiliza **SQLite**, um banco de dados que funciona por meio de um arquivo local, sem necessidade de instalar ou configurar um servidor de banco de dados.

O arquivo `database.sqlite` armazena os dados do sistema, como:

- Usuários cadastrados;
- Provas;
- Questões e alternativas;
- Resultados;
- Respostas dos usuários;
- Sessões.

**Importante:** se o arquivo do banco de dados já estiver incluído no projeto, mantenha-o no local esperado pelo código. Caso contrário, verifique a inicialização do banco em `src/BD.ts` para que a estrutura seja criada.

Não é necessário instalar um programa para visualizar ou editar o banco de dados para executar o sistema.

## 7. Executar o projeto

Na pasta principal, execute:

```bash
bun run server.ts
```

Se o arquivo `server.ts` estiver dentro da pasta `src`, execute:

```bash
bun run src/server.ts
```

Após iniciar o servidor, acesse pelo navegador:

```text
http://localhost:3000
```

Para interromper o servidor, pressione `Ctrl + C` no terminal.

## 8. Acesso administrativo

O sistema identifica o administrador pelo e-mail configurado no arquivo `.env`.

A conta administrativa possui permissões para gerenciar provas e questões, conforme as funcionalidades implementadas no sistema.

## 9. Observações

- Mantenha o servidor em execução enquanto estiver utilizando o sistema.
- Não exclua o arquivo `database.sqlite`, pois ele contém os dados cadastrados.
- Faça cópias de segurança do banco de dados periodicamente.
- Cada instalação local possui seu próprio banco de dados.
- Para acessar o sistema em outro computador, será necessário executar o servidor nesse computador ou configurar uma hospedagem.

## 10. Tecnologias utilizadas

| Tecnologia | Utilização |
|---|---|
| Bun | Execução do servidor e gerenciamento de dependências |
| TypeScript | Lógica do servidor |
| SQLite | Armazenamento dos dados |
| HTML | Estrutura das páginas |
| CSS | Estilização |
| JavaScript | Interatividade das páginas |
| Chart.js | Gráficos e estatísticas |

---

**Aprova IF — Sistema de simulados educacionais.**

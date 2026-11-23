import { AprovaIFDatabase, db as database } from "./BD.ts";
import { seedProvaIFC2026 } from "./seedProva2026.ts";
import path from "node:path";
import { mkdir } from "node:fs/promises";

// Garante que a prova oficial IFC 2026.1 exista no banco, sem duplicá-la.
seedProvaIFC2026(database);

const db = new AprovaIFDatabase();

const port = 3000;

const PUBLIC_DIR = path.resolve(
    import.meta.dir,
    "../public"
);

/* =================================================
   TIPOS DAS REQUISIÇÕES
===================================================== */

type CriarUsuarioBody = {
    nome: string;
    email: string;
    senha: string;
};

type LoginBody = {
    email: string;
    senha: string;
};

type AtualizarPerfilBody = {
    id: number;
    nome: string;
    foto?: string | null;
    compartilharEstatisticas?: boolean;
};

type CriarProvaBody = {
    titulo: string;
    ano?: number | null;
    tipo: string;
    curso?: string | null;
    campus?: string | null;
};

type CriarQuestaoBody = {
    materia: string;
    assunto?: string | null;
    texto: string;
    dificuldade?: number | null;
    tipo?: string;
    imagem?: string | null;
};

type CriarAlternativaBody = {
    letra: string;
    texto: string;
    correta: boolean;
    figura?: string | null;
};

type AdicionarQuestaoBody = {
    questaoId: number;
    ordem: number;
};

type RespostaBody = {
    questaoId: number;
    alternativaId: number | null;
};

type SimuladoPersonalizadoBody = {
    materias?: string[];
    quantidade?: number;
    dificuldade?: number | null;
    curso?: string | null;
    campus?: string | null;
};

type ResultadoVisitanteBody = {
    visitanteId: string;
    provaId: number;
    respostas: RespostaBody[];
};

type ResultadoBody = {
    usuarioId: number;
    provaId: number;
    nota?: number;
    acertos?: number;
    erros?: number;
    respostas?: RespostaBody[];
};

/* =====================================================
   FUNÇÕES AUXILIARES
===================================================== */

function numero(valor: string | null): number | null {
    if (valor === null) {
        return null;
    }

    const convertido = Number(valor);

    return Number.isFinite(convertido) ? convertido : null;
}

function respostaErro(mensagem: string, status = 400) {
    return Response.json(
        { erro: mensagem },
        { status }
    );
}

async function lerJson<T>(request: Request): Promise<T> {
    return await request.json() as T;
}


const NOME_COOKIE_SESSAO = "aprovaif_session";

function lerCookie(request: Request, nome: string): string | null {
    const cookies = request.headers.get("cookie");
    if (!cookies) return null;

    for (const parte of cookies.split(";")) {
        const [chave, ...valor] = parte.trim().split("=");
        if (chave === nome) {
            return decodeURIComponent(valor.join("="));
        }
    }

    return null;
}

function cookieSessao(idSessao: string, request: Request): string {
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return `${NOME_COOKIE_SESSAO}=${encodeURIComponent(idSessao)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400${secure}`;
}

function cookieSessaoExpirado(request: Request): string {
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return `${NOME_COOKIE_SESSAO}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

function usuarioDaSessao(request: Request) {
    const idSessao = lerCookie(request, NOME_COOKIE_SESSAO);
    return idSessao ? db.buscarSessao(idSessao) : null;
}

// ADMIN_EMAILS aceita um ou mais e-mails separados por vírgula.
 // Em desenvolvimento, a conta administrativa já existente no banco é o padrão.
 // Em produção, configure ADMIN_EMAILS no ambiente e remova o endereço de exemplo.
const EMAILS_ADMIN = new Set(
    (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "admin@exemplo.com")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
);

function ehDesenvolvedor(sessao: { email: string } | null | undefined) {
    return Boolean(sessao && EMAILS_ADMIN.has(sessao.email.trim().toLowerCase()));
}

/* =====================================================
   SERVIDOR
===================================================== */

Bun.serve({
    port,

    async fetch(request) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method;

        try {
            /* =================================================
               USUÁRIOS
            ================================================= */

            // POST /api/usuarios
            if (
                pathname === "/api/usuarios" &&
                method === "POST"
            ) {
                const body = await lerJson<CriarUsuarioBody>(request);

                if (
                    typeof body.nome !== "string" ||
                    typeof body.email !== "string" ||
                    typeof body.senha !== "string" ||
                    !body.nome.trim() ||
                    !body.email.trim() ||
                    !body.senha
                ) {
                    return respostaErro("Nome, email e senha são obrigatórios.");
                }

                const nome = body.nome.trim();
                const email = body.email.trim().toLowerCase();
                if (nome.length < 2 || nome.length > 100) {
                    return respostaErro("O nome deve ter entre 2 e 100 caracteres.");
                }
                if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    return respostaErro("Informe um e-mail válido.");
                }
                if (body.senha.length < 8) {
                    return respostaErro("A senha deve ter pelo menos 8 caracteres.");
                }

                try {
                    const usuario = await db.criarUsuario(
                        nome,
                        email,
                        body.senha
                    );

                    return Response.json(usuario, {
                        status: 201
                    });
                } catch (error) {
                    if (
                        error instanceof Error &&
                        (error.message === "EMAIL_JA_CADASTRADO" ||
                         error.message.includes("UNIQUE constraint failed: usuarios.email"))
                    ) {
                        return respostaErro(
                            "Este email já está cadastrado.",
                            409
                        );
                    }

                    throw error;
                }
            }

            // GET /api/usuarios?email=...
            if (
                pathname === "/api/usuarios" &&
                method === "GET"
            ) {
                const email = url.searchParams.get("email");

                if (!email) {
                    return respostaErro("Email não informado.");
                }

                const usuario = db.buscarUsuario(email);

                if (!usuario) {
                    return respostaErro(
                        "Usuário não encontrado.",
                        404
                    );
                }

                return Response.json(usuario);
            }

            // GET /api/usuarios/:id
            const usuarioMatch = pathname.match(
                /^\/api\/usuarios\/(\d+)$/
            );

            if (
                usuarioMatch &&
                method === "GET"
            ) {
                const id = Number(usuarioMatch[1]);
                const usuario = db.buscarUsuarioPorId(id);

                if (!usuario) {
                    return respostaErro(
                        "Usuário não encontrado.",
                        404
                    );
                }

                return Response.json(usuario);
            }

            // PUT /api/usuarios: atualiza o perfil do usuário logado.
            if (
                pathname === "/api/usuarios" &&
                method === "PUT"
            ) {
                const sessao = usuarioDaSessao(request);
                if (!sessao) {
                    return respostaErro("Faça login para editar o perfil.", 401);
                }

                const body = await lerJson<AtualizarPerfilBody>(request);
                const nome = typeof body.nome === "string" ? body.nome.trim() : "";

                if (nome.length < 2 || nome.length > 100) {
                    return respostaErro("O nome deve ter entre 2 e 100 caracteres.");
                }

                if (
                    body.compartilharEstatisticas !== undefined &&
                    typeof body.compartilharEstatisticas !== "boolean"
                ) {
                    return respostaErro("Valor inválido para compartilhar estatísticas.");
                }

                // O id vem da sessão; o id enviado pelo navegador é ignorado.
                const atual = db.buscarUsuarioPorId(sessao.usuarioId) as
                    | { foto_perfil: string | null }
                    | null;

                const resultado = db.atualizarPerfil(
                    sessao.usuarioId,
                    nome,
                    atual?.foto_perfil ?? null,
                    body.compartilharEstatisticas
                );

                if (!resultado.alterado) {
                    return respostaErro("Usuário não encontrado.", 404);
                }

                return Response.json(resultado);
            }

            // GET /api/perfil: dados do perfil + estatísticas do usuário logado.
            if (pathname === "/api/perfil" && method === "GET") {
                const sessao = usuarioDaSessao(request);
                if (!sessao) {
                    return respostaErro("Não autenticado.", 401);
                }

                const usuario = db.buscarUsuarioPorId(sessao.usuarioId);
                if (!usuario) {
                    return respostaErro("Usuário não encontrado.", 404);
                }

                return Response.json({
                    usuario,
                    ...db.estatisticasUsuario(sessao.usuarioId)
                });
            }

            // POST /api/login
            if (
                pathname === "/api/login" &&
                method === "POST"
            ) {
                const body = await lerJson<LoginBody>(request);

                if (
                    typeof body.email !== "string" ||
                    typeof body.senha !== "string" ||
                    !body.email.trim() ||
                    !body.senha
                ) {
                    return respostaErro("Email e senha são obrigatórios.");
                }

                const usuario = await db.validarLogin(
                    body.email.trim().toLowerCase(),
                    body.senha
                );

                if (!usuario) {
                    return respostaErro(
                        "Email ou senha inválidos.",
                        401
                    );
                }

                const sessao = db.criarSessao(usuario.id);

                return Response.json(usuario, {
                    headers: {
                        "Set-Cookie": cookieSessao(sessao.idSessao, request)
                    }
                });
            }

            // GET /api/me: identifica o usuário pela sessão do cookie.
            if (pathname === "/api/me" && method === "GET") {
                const idSessao = lerCookie(request, NOME_COOKIE_SESSAO);
                if (!idSessao) return respostaErro("Não autenticado.", 401);

                const sessao = db.buscarSessao(idSessao);
                if (!sessao) {
                    return Response.json(
                        { erro: "Sessão inválida ou expirada." },
                        { status: 401, headers: { "Set-Cookie": cookieSessaoExpirado(request) } }
                    );
                }

                return Response.json({
                    id: sessao.usuarioId,
                    nome: sessao.nome,
                    email: sessao.email,
                    isDev: ehDesenvolvedor(sessao)
                });
            }

            // POST /api/logout: encerra a sessão atual.
            if (pathname === "/api/logout" && method === "POST") {
                const idSessao = lerCookie(request, NOME_COOKIE_SESSAO);
                if (idSessao) db.removerSessao(idSessao);

                return Response.json(
                    { mensagem: "Logout realizado." },
                    { headers: { "Set-Cookie": cookieSessaoExpirado(request) } }
                );
            }

            /* =================================================
               PROVAS
            ================================================= */

            // Cadastro de provas oficiais/personalizadas: somente desenvolvedor.
            if (pathname === "/api/provas" && method === "POST") {
                const sessao = usuarioDaSessao(request);
                if (!ehDesenvolvedor(sessao)) {
                    return respostaErro("Cadastro de provas restrito à equipe de desenvolvimento.", 403);
                }
                const body = await lerJson<CriarProvaBody>(request);
                if (typeof body.titulo !== "string" || !body.titulo.trim() || !body.tipo) {
                    return respostaErro("Título e tipo são obrigatórios.");
                }
                const tipo = body.tipo.trim().toLowerCase();
                if (tipo !== "oficial" && tipo !== "personalizada") {
                    return respostaErro("O tipo deve ser 'oficial' ou 'personalizada'.");
                }
                const prova = db.criarProva(
                    body.titulo.trim(), body.ano ?? null, tipo,
                    sessao!.usuarioId, body.curso ?? null, body.campus ?? null
                );
                return Response.json(prova, { status: 201 });
            }

            // Edição e exclusão de provas oficiais: somente desenvolvedor.
            const provaAdminMatch = pathname.match(/^\/api\/provas\/(\d+)$/);
            if (provaAdminMatch && (method === "PUT" || method === "DELETE")) {
                if (!ehDesenvolvedor(usuarioDaSessao(request))) {
                    return respostaErro("Somente desenvolvedores podem editar ou excluir provas.", 403);
                }

                const provaId = Number(provaAdminMatch[1]);
                const existente = db.buscarProva(provaId);
                if (!existente) return respostaErro("Prova não encontrada.", 404);

                if (method === "DELETE") {
                    db.excluirProva(provaId);
                    return Response.json({ mensagem: "Prova excluída com sucesso." });
                }

                const body = await lerJson<Partial<CriarProvaBody>>(request);
                const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
                const tipo = typeof body.tipo === "string" ? body.tipo.trim().toLowerCase() : "";
                if (!titulo || titulo.length > 180) return respostaErro("Informe um título de até 180 caracteres.");
                if (!["oficial", "personalizada"].includes(tipo)) return respostaErro("Tipo de prova inválido.");
                const ano = body.ano == null ? null : Number(body.ano);
                if (ano !== null && (!Number.isInteger(ano) || ano < 1900 || ano > 2200)) {
                    return respostaErro("Informe um ano válido.");
                }
                const provaAtualizada = db.atualizarProva(provaId, {
                    titulo, tipo, ano,
                    curso: typeof body.curso === "string" ? body.curso.trim() : null,
                    campus: typeof body.campus === "string" ? body.campus.trim() : null
                });
                return Response.json(provaAtualizada);
            }

            // Indicadores reais da plataforma para a página inicial.
            if (pathname === "/api/estatisticas-publicas" && method === "GET") {
                return Response.json(db.estatisticasPublicas());
            }

            // Filtros disponíveis para a tela pública de provas.
            if (pathname === "/api/provas/filtros" && method === "GET") {
                const sessao = usuarioDaSessao(request);
                return Response.json(db.filtrosProvas(sessao?.usuarioId ?? null));
            }

            // Gerar simulado a partir do banco de questões existente.
            if (pathname === "/api/simulados/personalizados" && method === "POST") {
                const sessao = usuarioDaSessao(request);
                if (!sessao) return respostaErro("Entre na sua conta para gerar e guardar simulados privados.", 401);
                const body = await lerJson<SimuladoPersonalizadoBody>(request);
                const materias = Array.isArray(body.materias)
                    ? body.materias.filter((item) => typeof item === "string").slice(0, 20)
                    : [];
                const quantidade = Number(body.quantidade ?? 10);
                const dificuldade = body.dificuldade === null || body.dificuldade === undefined
                    ? null : Number(body.dificuldade);
                if (!Number.isFinite(quantidade) || quantidade < 1 || quantidade > 40) {
                    return respostaErro("A quantidade deve ficar entre 1 e 40 questões.");
                }
                if (dificuldade !== null && ![1, 2, 3].includes(dificuldade)) {
                    return respostaErro("Selecione uma dificuldade válida.");
                }
                try {
                    const prova = db.gerarSimuladoPersonalizado(materias, quantidade, dificuldade, sessao.usuarioId, body.curso, body.campus);
                    return Response.json(prova, { status: 201 });
                } catch (error) {
                    if (error instanceof Error && error.message === "SEM_QUESTOES_PARA_SIMULADO") {
                        return respostaErro("Ainda não há questões suficientes para esses filtros. Tente outra matéria ou dificuldade.", 422);
                    }
                    throw error;
                }
            }

            // GET /api/provas?tipo=&ano=&curso=&campus=
            if (pathname === "/api/provas" && method === "GET") {
                const anoTexto = url.searchParams.get("ano");
                const ano = anoTexto && Number.isFinite(Number(anoTexto)) ? Number(anoTexto) : null;
                const sessao = usuarioDaSessao(request);
                return Response.json(db.listarProvas({
                    usuarioId: sessao?.usuarioId ?? null,
                    tipo: url.searchParams.get("tipo"),
                    ano,
                    curso: url.searchParams.get("curso"),
                    campus: url.searchParams.get("campus")
                }));
            }

            // GET /api/provas/:id
            const provaMatch = pathname.match(
                /^\/api\/provas\/(\d+)$/
            );

            if (
                provaMatch &&
                method === "GET"
            ) {
                const id = Number(provaMatch[1]);
                const prova = db.buscarProva(id);

                if (!prova) return respostaErro("Prova não encontrada.", 404);
                const sessao = usuarioDaSessao(request);
                if (!db.provaPertenceAoUsuario(id, sessao?.usuarioId ?? -1)) {
                    return respostaErro("Esta prova pertence a outro usuário.", 403);
                }
                return Response.json(prova);
            }

            /* =================================================
               IMAGENS DE QUESTÕES
            ================================================= */

            // POST /api/imagens-questao — upload de imagem de enunciado.
            if (pathname === "/api/imagens-questao" && method === "POST") {
                if (!ehDesenvolvedor(usuarioDaSessao(request))) return respostaErro("Apenas desenvolvedores podem enviar imagens para o banco de questões.", 403);
                const contentLength = Number(request.headers.get("content-length") || 0);
                if (contentLength > 5 * 1024 * 1024 + 1024 * 1024) {
                    return respostaErro("A imagem deve ter no máximo 5 MB.", 413);
                }

                const formData = await request.formData();
                const arquivo = formData.get("imagem");
                if (!(arquivo instanceof File)) {
                    return respostaErro("Selecione uma imagem para enviar.");
                }
                if (arquivo.size < 1 || arquivo.size > 5 * 1024 * 1024) {
                    return respostaErro("A imagem deve ter entre 1 byte e 5 MB.", 413);
                }

                const extensoesPermitidas: Record<string, string> = {
                    "image/jpeg": ".jpg",
                    "image/png": ".png",
                    "image/webp": ".webp",
                    "image/gif": ".gif"
                };
                const extensao = extensoesPermitidas[arquivo.type];
                if (!extensao) {
                    return respostaErro("Formato não permitido. Use PNG, JPG, WEBP ou GIF.");
                }

                const diretorioImagens = path.join(PUBLIC_DIR, "assets", "images", "questions");
                await mkdir(diretorioImagens, { recursive: true });
                const nomeArquivo = `${crypto.randomUUID()}${extensao}`;
                await Bun.write(path.join(diretorioImagens, nomeArquivo), arquivo);
                return Response.json({ url: `/assets/images/questions/${nomeArquivo}` }, { status: 201 });
            }

            /* =================================================
               QUESTÕES
            ================================================= */

            // POST /api/questoes
            if (
                pathname === "/api/questoes" &&
                method === "POST"
            ) {
                if (!ehDesenvolvedor(usuarioDaSessao(request))) return respostaErro("Cadastro de questões restrito à equipe de desenvolvimento.", 403);
                const body = await lerJson<CriarQuestaoBody>(request);

                if (!body.materia || !body.texto) {
                    return respostaErro(
                        "Matéria e texto são obrigatórios."
                    );
                }

                if (body.imagem != null && (typeof body.imagem !== "string" || body.imagem.length > 500 || !body.imagem.startsWith("/assets/images/questions/"))) {
                    return respostaErro("O endereço da imagem da questão é inválido.");
                }

                const questao = db.criarQuestao(
                    body.materia,
                    body.assunto ?? null,
                    body.texto,
                    body.dificuldade ?? null,
                    body.tipo ?? "multipla escolha",
                    body.imagem ?? null
                );

                return Response.json(questao, {
                    status: 201
                });
            }

            // POST /api/questoes/:id/alternativas
            const alternativaMatch = pathname.match(
                /^\/api\/questoes\/(\d+)\/alternativas$/
            );

            if (
                alternativaMatch &&
                method === "POST"
            ) {
                if (!ehDesenvolvedor(usuarioDaSessao(request))) return respostaErro("Cadastro de alternativas restrito à equipe de desenvolvimento.", 403);
                const questaoId = Number(alternativaMatch[1]);
                const body = await lerJson<CriarAlternativaBody>(request);

                if (!body.letra || !body.texto) {
                    return respostaErro(
                        "Letra e texto são obrigatórios."
                    );
                }

                const alternativa = db.criarAlternativa(
                    questaoId,
                    body.letra,
                    body.texto,
                    body.correta,
                    body.figura ?? null
                );

                return Response.json(alternativa, {
                    status: 201
                });
            }

            // POST /api/provas/:id/questoes
            const provaQuestaoMatch = pathname.match(
                /^\/api\/provas\/(\d+)\/questoes$/
            );

            if (
                provaQuestaoMatch &&
                method === "POST"
            ) {
                if (!ehDesenvolvedor(usuarioDaSessao(request))) return respostaErro("Edição de provas restrita à equipe de desenvolvimento.", 403);
                const provaId = Number(provaQuestaoMatch[1]);
                const body = await lerJson<AdicionarQuestaoBody>(request);

                if (!body.questaoId || !body.ordem) {
                    return respostaErro(
                        "questaoId e ordem são obrigatórios."
                    );
                }

                const resultado = db.adicionarQuestaoNaProva(
                    provaId,
                    body.questaoId,
                    body.ordem
                );

                return Response.json(resultado, {
                    status: 201
                });
            }

            // GET /api/provas/:id/questoes
            if (
                provaQuestaoMatch &&
                method === "GET"
            ) {
                const provaId = Number(provaQuestaoMatch[1]);
                const sessao = usuarioDaSessao(request);
                if (!db.provaPertenceAoUsuario(provaId, sessao?.usuarioId ?? -1)) {
                    return respostaErro("Esta prova pertence a outro usuário.", 403);
                }
                return Response.json(db.listarQuestoesDaProva(provaId));
            }

            /* =================================================
               RESULTADOS
            ================================================= */

            // POST /api/resultados
            if (
                pathname === "/api/resultados" &&
                method === "POST"
            ) {
                const body = await lerJson<ResultadoBody>(request);
                const idSessao = lerCookie(request, NOME_COOKIE_SESSAO);
                const sessao = idSessao ? db.buscarSessao(idSessao) : null;

                if (!sessao) {
                    return respostaErro("Faça login para salvar resultados na sua conta.", 401);
                }

                if (!Number.isInteger(body.provaId) || body.provaId < 1 || !Array.isArray(body.respostas)) {
                    return respostaErro("Prova e respostas são obrigatórias.");
                }
                if (!db.provaPertenceAoUsuario(body.provaId, sessao.usuarioId)) {
                    return respostaErro("Você não tem acesso a esta prova.", 403);
                }

                // O usuário é obtido da sessão; não confiamos em usuarioId enviado pelo navegador.
                const resultado = db.salvarResultado(
                    sessao.usuarioId,
                    body.provaId,
                    0,
                    0
                );

               let resultadoFinal: {
                    resultadoId: number;
                    nota: number;
                    acertos: number;
                    erros: number;
                };

                if (body.respostas) {
                    resultadoFinal = db.salvarRespostasDoResultado(
                        resultado.id,
                        body.respostas
                    );
                }

                return Response.json({
                    resultadoId: resultado.id,
                    ...(body.respostas ? resultadoFinal! : {
                        nota: body.nota ?? 0,
                        acertos: body.acertos ?? 0,
                        erros: body.erros ?? 0
                    })
                }, { status: 201 });
            }

            // Salvar resultados de visitantes sem exigir cadastro.
            if (pathname === "/api/resultados-visitantes" && method === "POST") {
                const body = await lerJson<ResultadoVisitanteBody>(request);
                if (typeof body.visitanteId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.visitanteId)) {
                    return respostaErro("Identificador de visitante inválido.");
                }
                if (!Number.isInteger(body.provaId) || body.provaId < 1 || !Array.isArray(body.respostas)) {
                    return respostaErro("Prova e respostas são obrigatórias.");
                }
                if (!db.provaPertenceAoUsuario(body.provaId, -1)) return respostaErro("Esta prova exige acesso pela conta que a criou.", 403);
                const resultado = db.salvarResultadoVisitante(body.visitanteId, body.provaId, body.respostas);
                return Response.json(resultado, { status: 201 });
            }

            if (pathname === "/api/historico-visitante" && method === "GET") {
                const visitanteId = url.searchParams.get("visitanteId") || "";
                if (!/^[a-zA-Z0-9-]{16,80}$/.test(visitanteId)) {
                    return respostaErro("Identificador de visitante inválido.");
                }
                return Response.json(db.historicoVisitante(visitanteId));
            }

            // GET /api/resultados/:id
            const resultadoMatch = pathname.match(
                /^\/api\/resultados\/(\d+)$/
            );

            if (
                resultadoMatch &&
                method === "GET"
            ) {
                const id = Number(resultadoMatch[1]);
                const resultado = db.buscarResultado(id);

                if (!resultado) return respostaErro("Resultado não encontrado.", 404);
                const sessao = usuarioDaSessao(request);
                if (!sessao || resultado.usuario_id !== sessao.usuarioId) {
                    return respostaErro("Acesso negado.", 403);
                }
                return Response.json(resultado);
            }

            /* =================================================
               ESTATÍSTICAS
            ================================================= */

            // GET /api/estatisticas/:id
            const estatisticasMatch = pathname.match(
                /^\/api\/estatisticas\/(\d+)$/
            );

            if (
                estatisticasMatch &&
                method === "GET"
            ) {
                const usuarioId = Number(estatisticasMatch[1]);
                const sessao = usuarioDaSessao(request);

                if (!sessao || sessao.usuarioId !== usuarioId) {
                    return respostaErro("Acesso negado.", 403);
                }

                return Response.json(
                    db.estatisticasUsuario(usuarioId)
                );
            }

            // GET /api/usuarios/:id/estatisticas
            const usuarioEstatisticasMatch = pathname.match(
                /^\/api\/usuarios\/(\d+)\/estatisticas$/
            );

            if (
                usuarioEstatisticasMatch &&
                method === "GET"
            ) {
                const usuarioId = Number(
                    usuarioEstatisticasMatch[1]
                );
                const sessao = usuarioDaSessao(request);

                if (!sessao || sessao.usuarioId !== usuarioId) {
                    return respostaErro("Acesso negado.", 403);
                }

                return Response.json(
                    db.estatisticasUsuario(usuarioId)
                );
            }

            /* =================================================
               RANKING
            ================================================= */

            if (
                pathname === "/api/ranking" &&
                method === "GET"
            ) {
                return Response.json(db.ranking());
            }

            if (
                pathname === "/api/ranking/todos" &&
                method === "GET"
            ) {
                const sessao = usuarioDaSessao(request);
                const emailAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase();

                if (!sessao || !emailAdmin || sessao.email.toLowerCase() !== emailAdmin) {
                    return respostaErro("Acesso restrito ao administrador.", 403);
                }

                return Response.json(db.rankingTodos());
            }

            /* =================================================
               MELHORES DESEMPENHOS POR MATÉRIA
            ================================================= */

            if (
                pathname === "/api/materias" &&
                method === "GET"
            ) {
                return Response.json(
                    db.melhoresNotasMateria()
                );
            }

            /* =================================================
               HISTÓRICO DO USUÁRIO
            ================================================= */

            const historicoMatch = pathname.match(
                /^\/api\/usuarios\/(\d+)\/historico$/
            );

            if (
                historicoMatch &&
                method === "GET"
            ) {
                const usuarioId = Number(historicoMatch[1]);
                const sessao = usuarioDaSessao(request);

                if (!sessao || sessao.usuarioId !== usuarioId) {
                    return respostaErro("Acesso negado.", 403);
                }

                return Response.json(
                    db.historicoUsuario(usuarioId)
                );
            }

            /* =================================================
               ARQUIVOS ESTÁTICOS
            ================================================= */

            if (pathname === "/cadastrar-prova" || pathname === "/cadastrar-prova.html") {
                if (!ehDesenvolvedor(usuarioDaSessao(request))) {
                    return new Response("Acesso restrito à equipe de desenvolvimento.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } });
                }
            }

            let arquivoPath = pathname;

            if (arquivoPath === "/") {
                arquivoPath = "/index.html";
            }
            else if (!arquivoPath.includes(".")) {
                arquivoPath += ".html";
            }

            const filePath = path.join(
                PUBLIC_DIR,
                arquivoPath
            );

            const file = Bun.file(filePath);

            if (await file.exists()) {
                return new Response(file);
            }

            return new Response(
                "Página não encontrada",
                { status: 404 }
            );
        }
        catch (error) {
            console.error(error);

            return respostaErro(
                "Erro interno do servidor.",
                500
            );
        }
    }
});

console.log(
    `Servidor rodando em http://localhost:${port}`
);

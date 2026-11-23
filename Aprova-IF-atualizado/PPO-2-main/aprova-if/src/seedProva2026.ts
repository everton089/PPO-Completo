import { readFileSync } from "node:fs";
import path from "node:path";

type SeedOption = { letra: string; texto: string; correta: boolean };
type SeedQuestion = {
    ordem: number;
    materia: string;
    assunto: string | null;
    texto: string;
    imagem: string | null;
    dificuldade: number | null;
    alternativas: SeedOption[];
};
type SeedExam = {
    titulo: string;
    ano: number;
    tipo: string;
    curso: string | null;
    campus: string | null;
    questoes: SeedQuestion[];
};

const arquivoDados = path.resolve(import.meta.dir, "data/prova-ifc-2026-1.json");
const prova = JSON.parse(readFileSync(arquivoDados, "utf8")) as SeedExam;

/**
 * Insere a prova oficial no banco uma única vez.
 * A rotina é idempotente: reiniciar o servidor não duplica a prova nem as questões.
 */
export function seedProvaIFC2026(database: any) {
    const executar = database.transaction(() => {
        database.query("INSERT OR IGNORE INTO tipo_prova (descricao) VALUES ('oficial')").run();
        database.query("INSERT OR IGNORE INTO tipo_questao (descricao) VALUES ('multipla escolha')").run();

        const existente = database.query(`
            SELECT p.id_prova AS id
            FROM provas p
            INNER JOIN tipo_prova tp ON tp.id_tipo_prova = p.id_tipo_prova
            WHERE p.titulo = ? AND p.ano = ? AND LOWER(tp.descricao) = 'oficial'
            LIMIT 1
        `).get(prova.titulo, prova.ano) as { id: number } | null;

        let provaId = existente?.id ?? null;
        if (provaId !== null) {
            const total = database.query(
                "SELECT COUNT(*) AS total FROM prova_questao WHERE id_prova = ?"
            ).get(provaId) as { total: number };
            if (Number(total.total) === prova.questoes.length) return;
            if (Number(total.total) > 0) return;
        } else {
            const result = database.query(`
                INSERT INTO provas (id_tipo_prova, id_criador, titulo, ano, curso, campus)
                VALUES (
                    (SELECT id_tipo_prova FROM tipo_prova WHERE LOWER(descricao) = 'oficial'),
                    NULL, ?, ?, ?, ?
                )
            `).run(prova.titulo, prova.ano, prova.curso, prova.campus);
            provaId = Number(result.lastInsertRowid);
        }

        const tipoQuestao = database.query(
            "SELECT id_tipo_questao AS id FROM tipo_questao WHERE LOWER(descricao) = 'multipla escolha'"
        ).get() as { id: number };

        const inserirQuestao = database.query(`
            INSERT INTO questoes (id_tipo_questao, materia, assunto, texto, imagem, dificuldade)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const inserirAlternativa = database.query(`
            INSERT INTO alternativas (id_questao, letra, texto, correta, figura)
            VALUES (?, ?, ?, ?, NULL)
        `);
        const vincularQuestao = database.query(`
            INSERT INTO prova_questao (id_prova, id_questao, ordem)
            VALUES (?, ?, ?)
        `);

        for (const questao of prova.questoes) {
            const result = inserirQuestao.run(
                tipoQuestao.id,
                questao.materia,
                questao.assunto,
                questao.texto,
                questao.imagem,
                questao.dificuldade
            );
            const questaoId = Number(result.lastInsertRowid);

            for (const alternativa of questao.alternativas) {
                inserirAlternativa.run(
                    questaoId,
                    alternativa.letra,
                    alternativa.texto,
                    alternativa.correta ? 1 : 0
                );
            }
            vincularQuestao.run(provaId, questaoId, questao.ordem);
        }
    });

    executar();
}

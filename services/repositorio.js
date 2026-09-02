import { mongoose } from '../config/conexao.js';
import Usuario from '../models/usuario.js';
import Tcc from '../models/tcc.js';
import Ideia from '../models/ideia.js';
import Comentario from '../models/comentario.js';
import Curso from '../models/curso.js';
import Turma from '../models/turma.js';
import {
    usuarios,
    tccs,
    ideias,
    comentarios,
    cursos,
    turmas,
    novoId,
} from '../data/mock.js';
import { normalizarTexto, escaparRegex } from './texto.js';

const usandoMongo = () => mongoose.connection.readyState === 1;
const idValido = (id) => mongoose.Types.ObjectId.isValid(id);

function usuarioPublico(usuario) {
    if (!usuario) return null;
    return {
        id: String(usuario.id || usuario._id),
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        curso: usuario.curso || '',
        areaAtuacao: usuario.areaAtuacao || '',
        ativo: usuario.ativo !== false,
        emailVerificado: usuario.emailVerificado === true,
    };
}

function autorDemo(autorId) {
    return usuarioPublico(usuarios.find((usuario) => usuario.id === autorId));
}

function preencherPublicacaoDemo(publicacao) {
    return {
        ...publicacao,
        autor: autorDemo(publicacao.autorId),
        orientadorUsuario: autorDemo(publicacao.orientadorId),
    };
}

export async function buscarUsuarioPorEmail(email) {
    if (usandoMongo()) {
        return Usuario.findOne({ email: normalizarTexto(email) }).select('+senha +googleId');
    }
    return usuarios.find((usuario) => usuario.email === normalizarTexto(email)) || null;
}

export async function buscarUsuarioPorGoogleId(googleId) {
    if (!usandoMongo() || !googleId) return null;
    return Usuario.findOne({ googleId }).select('+senha +googleId');
}

export async function buscarUsuarioPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Usuario.findById(id);
    }
    return usuarios.find((usuario) => usuario.id === String(id)) || null;
}

export async function buscarUsuarioComCredenciaisPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Usuario.findById(id).select('+senha +googleId');
    }
    return buscarUsuarioPorId(id);
}

export async function cadastrarUsuario(dados) {
    if (usandoMongo()) return Usuario.create(dados);
    const usuario = { id: novoId(), ...dados };
    usuarios.push(usuario);
    return usuario;
}

export async function vincularContaGoogle(usuarioId, googleId) {
    if (!usandoMongo() || !idValido(usuarioId)) return null;
    return Usuario.findByIdAndUpdate(
        usuarioId,
        { googleId },
        { new: true, runValidators: true },
    ).select('+senha +googleId');
}

export async function confirmarAcessoUsuario(usuarioId) {
    if (!usandoMongo() || !idValido(usuarioId)) return buscarUsuarioPorId(usuarioId);
    return Usuario.findByIdAndUpdate(
        usuarioId,
        { emailVerificado: true, ultimoLogin: new Date() },
        { new: true },
    );
}

export async function registrarLoginUsuario(usuarioId) {
    if (!usandoMongo() || !idValido(usuarioId)) return buscarUsuarioPorId(usuarioId);
    return Usuario.findByIdAndUpdate(
        usuarioId,
        { ultimoLogin: new Date() },
        { new: true },
    );
}

export async function atualizarSenhaUsuario(usuarioId, senha) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return null;
        return Usuario.findByIdAndUpdate(
            usuarioId,
            { senha },
            { new: true, runValidators: true },
        );
    }
    const usuario = usuarios.find((item) => item.id === String(usuarioId));
    if (!usuario) return null;
    usuario.senha = senha;
    return usuario;
}

export async function listarUsuarios(q = '') {
    if (usandoMongo()) {
        const filtro = q ? {
            $or: [
                { nome: new RegExp(escaparRegex(q), 'i') },
                { email: new RegExp(escaparRegex(q), 'i') },
            ],
        } : {};
        return Usuario.find(filtro).sort({ nome: 1 }).lean();
    }
    const termo = normalizarTexto(q);
    return usuarios
        .filter((usuario) => !termo || normalizarTexto(`${usuario.nome} ${usuario.email}`).includes(termo))
        .map(usuarioPublico)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function alterarStatusUsuario(usuarioId, ativo) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return null;
        return Usuario.findByIdAndUpdate(usuarioId, { ativo }, { new: true });
    }
    const usuario = usuarios.find((item) => item.id === String(usuarioId));
    if (!usuario) return null;
    usuario.ativo = ativo;
    return usuario;
}

export async function atualizarPerfilUsuario(usuarioId, perfil) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return null;
        return Usuario.findByIdAndUpdate(usuarioId, { perfil }, { new: true, runValidators: true })
            .select('+senha +googleId');
    }
    const usuario = usuarios.find((item) => item.id === String(usuarioId));
    if (!usuario) return null;
    usuario.perfil = perfil;
    return usuario;
}

export async function atualizarDadosPerfilUsuario(usuarioId, dados) {
    const atualizacao = {
        nome: String(dados.nome || '').trim(),
        curso: String(dados.curso || '').trim(),
        areaAtuacao: String(dados.areaAtuacao || '').trim(),
    };
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return null;
        return Usuario.findByIdAndUpdate(
            usuarioId,
            atualizacao,
            { new: true, runValidators: true },
        );
    }
    const usuario = usuarios.find((item) => item.id === String(usuarioId));
    if (!usuario) return null;
    Object.assign(usuario, atualizacao);
    return usuario;
}

export async function listarProfessores() {
    if (usandoMongo()) {
        return Usuario.find({ perfil: 'professor', ativo: { $ne: false }, emailVerificado: true })
            .sort({ nome: 1 })
            .lean();
    }
    return usuarios
        .filter((usuario) => usuario.perfil === 'professor' && usuario.ativo !== false)
        .map(usuarioPublico);
}

export async function listarTccs({
    q = '',
    curso = '',
    ano = '',
    area = '',
    orientador = '',
    ordem = 'recentes',
} = {}) {
    if (usandoMongo()) {
        const filtros = { $and: [{ $or: [{ status: 'publicado' }, { status: { $exists: false } }] }] };
        if (q) {
            const termo = new RegExp(escaparRegex(q), 'i');
            filtros.$and.push({ $or: [
                { titulo: termo },
                { tema: termo },
                { resumo: termo },
                { orientador: termo },
                { curso: termo },
                { area: termo },
                { palavrasChave: termo },
            ] });
        }
        if (curso) filtros.curso = new RegExp(`^${escaparRegex(curso)}$`, 'i');
        if (ano) filtros.ano = Number(ano);
        if (area) filtros.area = new RegExp(`^${escaparRegex(area)}$`, 'i');
        if (orientador) filtros.orientador = new RegExp(`^${escaparRegex(orientador)}$`, 'i');

        const ordenacoes = {
            recentes: { createdAt: -1 },
            visualizados: { visualizacoes: -1, createdAt: -1 },
            downloads: { downloads: -1, createdAt: -1 },
            az: { titulo: 1 },
        };

        return Tcc.find(filtros)
            .populate('autor', 'nome perfil curso')
            .sort(ordenacoes[ordem] || ordenacoes.recentes)
            .lean();
    }

    const termo = normalizarTexto(q);
    const resultado = tccs
        .filter((tcc) => {
            const autor = autorDemo(tcc.autorId);
            const texto = normalizarTexto([
                tcc.titulo,
                tcc.tema,
                tcc.resumo,
                tcc.curso,
                tcc.area,
                tcc.orientador,
                autor?.nome,
                ...tcc.palavrasChave,
            ].join(' '));
            return (tcc.status === 'publicado' || !tcc.status)
                && (!termo || texto.includes(termo))
                && (!curso || normalizarTexto(tcc.curso) === normalizarTexto(curso))
                && (!ano || String(tcc.ano) === String(ano))
                && (!area || normalizarTexto(tcc.area) === normalizarTexto(area))
                && (!orientador || normalizarTexto(tcc.orientador) === normalizarTexto(orientador));
        })
        .map(preencherPublicacaoDemo);

    const comparadores = {
        recentes: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        visualizados: (a, b) => (b.visualizacoes || 0) - (a.visualizacoes || 0),
        downloads: (a, b) => (b.downloads || 0) - (a.downloads || 0),
        az: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'),
    };

    return resultado.sort(comparadores[ordem] || comparadores.recentes);
}

export async function buscarTccPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Tcc.findById(id)
            .populate('autor', 'nome perfil curso')
            .populate('orientadorUsuario', 'nome email perfil')
            .lean();
    }
    const tcc = tccs.find((item) => item.id === String(id));
    return tcc ? preencherPublicacaoDemo(tcc) : null;
}

export async function cadastrarTcc(dados) {
    if (usandoMongo()) return Tcc.create(dados);
    const tcc = {
        id: novoId(),
        createdAt: new Date(),
        visualizacoes: 0,
        downloads: 0,
        status: 'em_analise',
        feedbackOrientador: '',
        ...dados,
        autorId: String(dados.autor),
    };
    delete tcc.autor;
    tccs.push(tcc);
    return preencherPublicacaoDemo(tcc);
}

export async function buscarTccDoAluno(usuarioId) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return null;
        return Tcc.findOne({ autor: usuarioId })
            .populate('autor', 'nome perfil curso')
            .populate('orientadorUsuario', 'nome email perfil')
            .lean();
    }
    const tcc = tccs.find((item) => item.autorId === String(usuarioId));
    return tcc ? preencherPublicacaoDemo(tcc) : null;
}

export async function listarTccsDoOrientador(usuarioId) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return [];
        return Tcc.find({ orientadorUsuario: usuarioId })
            .populate('autor', 'nome email curso perfil')
            .sort({ updatedAt: -1 })
            .lean();
    }
    return tccs
        .filter((item) => item.orientadorId === String(usuarioId))
        .map(preencherPublicacaoDemo);
}

export async function listarTodosTccs() {
    if (usandoMongo()) {
        return Tcc.find({})
            .populate('autor', 'nome email curso perfil')
            .populate('orientadorUsuario', 'nome email perfil')
            .sort({ updatedAt: -1 })
            .lean();
    }
    return tccs.map(preencherPublicacaoDemo);
}

export async function avaliarTcc(id, { status, feedbackOrientador }) {
    const dados = {
        status,
        feedbackOrientador: String(feedbackOrientador || '').trim(),
        avaliadoEm: new Date(),
    };
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Tcc.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    }
    return atualizarTcc(id, dados);
}

export async function atualizarTcc(id, dados) {
    if (usandoMongo()) return Tcc.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    const indice = tccs.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    tccs[indice] = { ...tccs[indice], ...dados };
    return preencherPublicacaoDemo(tccs[indice]);
}

export async function excluirTcc(id) {
    if (usandoMongo()) {
        await Promise.all([
            Tcc.findByIdAndDelete(id),
            Comentario.deleteMany({ alvoTipo: 'Tcc', alvo: id }),
        ]);
        return;
    }
    const indice = tccs.findIndex((item) => item.id === String(id));
    if (indice >= 0) tccs.splice(indice, 1);
    for (let i = comentarios.length - 1; i >= 0; i -= 1) {
        if (comentarios[i].alvoTipo === 'tcc' && comentarios[i].alvoId === String(id)) comentarios.splice(i, 1);
    }
}

export async function obterPdfTcc(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        const tcc = await Tcc.findById(id).select('+pdf.dados').lean();
        return tcc?.pdf?.dados ? tcc.pdf : null;
    }
    return tccs.find((item) => item.id === String(id))?.pdf || null;
}

export async function registrarVisualizacaoTcc(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return;
        await Tcc.findByIdAndUpdate(id, { $inc: { visualizacoes: 1 } });
        return;
    }

    const tcc = tccs.find((item) => item.id === String(id));
    if (tcc) tcc.visualizacoes = (tcc.visualizacoes || 0) + 1;
}

export async function registrarDownloadTcc(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return;
        await Tcc.findByIdAndUpdate(id, { $inc: { downloads: 1 } });
        return;
    }

    const tcc = tccs.find((item) => item.id === String(id));
    if (tcc) tcc.downloads = (tcc.downloads || 0) + 1;
}

export async function listarTccsRelacionados(tcc, limite = 3) {
    if (!tcc) return [];
    const idAtual = String(tcc.id || tcc._id);
    const todos = await listarTccs();

    return todos
        .filter((item) => String(item.id || item._id) !== idAtual)
        .filter((item) => item.curso === tcc.curso || item.area === tcc.area)
        .slice(0, limite);
}

export async function listarIdeias({ q = '', curso = '', status = '', dificuldade = '' } = {}) {
    if (usandoMongo()) {
        const filtros = {};
        if (q) {
            const termo = new RegExp(escaparRegex(q), 'i');
            filtros.$or = [{ titulo: termo }, { tema: termo }, { descricao: termo }];
        }
        if (curso) filtros.curso = curso;
        if (status) filtros.status = status;
        if (dificuldade) filtros.dificuldade = dificuldade;
        return Ideia.find(filtros).populate('autor', 'nome perfil curso areaAtuacao').sort({ createdAt: -1 }).lean();
    }

    const termo = normalizarTexto(q);
    return ideias
        .filter((ideia) => {
            const texto = normalizarTexto(`${ideia.titulo} ${ideia.tema} ${ideia.descricao}`);
            return (!termo || texto.includes(termo))
                && (!curso || ideia.curso === curso)
                && (!status || ideia.status === status)
                && (!dificuldade || ideia.dificuldade === dificuldade);
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(preencherPublicacaoDemo);
}

export async function buscarIdeiaPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Ideia.findById(id).populate('autor', 'nome perfil curso areaAtuacao').lean();
    }
    const ideia = ideias.find((item) => item.id === String(id));
    return ideia ? preencherPublicacaoDemo(ideia) : null;
}

export async function cadastrarIdeia(dados) {
    if (usandoMongo()) return Ideia.create(dados);
    const ideia = { id: novoId(), createdAt: new Date(), ...dados, autorId: String(dados.autor) };
    delete ideia.autor;
    ideias.push(ideia);
    return preencherPublicacaoDemo(ideia);
}

export async function atualizarIdeia(id, dados) {
    if (usandoMongo()) return Ideia.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    const indice = ideias.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    ideias[indice] = { ...ideias[indice], ...dados };
    return preencherPublicacaoDemo(ideias[indice]);
}

export async function excluirIdeia(id) {
    if (usandoMongo()) {
        await Promise.all([
            Ideia.findByIdAndDelete(id),
            Comentario.deleteMany({ alvoTipo: 'Ideia', alvo: id }),
        ]);
        return;
    }
    const indice = ideias.findIndex((item) => item.id === String(id));
    if (indice >= 0) ideias.splice(indice, 1);
    for (let i = comentarios.length - 1; i >= 0; i -= 1) {
        if (comentarios[i].alvoTipo === 'ideia' && comentarios[i].alvoId === String(id)) comentarios.splice(i, 1);
    }
}

export async function listarComentarios(alvoTipo, alvoId) {
    if (usandoMongo()) {
        const tipoModel = alvoTipo === 'tcc' ? 'Tcc' : 'Ideia';
        if (!idValido(alvoId)) return [];
        return Comentario.find({ alvoTipo: tipoModel, alvo: alvoId })
            .populate('autor', 'nome perfil')
            .sort({ createdAt: 1 })
            .lean();
    }

    return comentarios
        .filter((comentario) => comentario.alvoTipo === alvoTipo && comentario.alvoId === String(alvoId))
        .map((comentario) => ({ ...comentario, autor: autorDemo(comentario.autorId) }));
}

export async function cadastrarComentario({ texto, autor, alvoTipo, alvoId }) {
    if (usandoMongo()) {
        return Comentario.create({
            texto,
            autor,
            alvoTipo: alvoTipo === 'tcc' ? 'Tcc' : 'Ideia',
            alvo: alvoId,
        });
    }
    const comentario = {
        id: novoId(),
        texto,
        autorId: String(autor),
        alvoTipo,
        alvoId: String(alvoId),
        createdAt: new Date(),
    };
    comentarios.push(comentario);
    return comentario;
}

export async function resumoDoPainel(usuarioId) {
    if (usandoMongo()) {
        const [totalTccs, totalIdeias, totalComentarios] = await Promise.all([
            Tcc.countDocuments({ autor: usuarioId }),
            Ideia.countDocuments({ autor: usuarioId }),
            Comentario.countDocuments({ autor: usuarioId }),
        ]);
        return { totalTccs, totalIdeias, totalComentarios };
    }

    return {
        totalTccs: tccs.filter((tcc) => tcc.autorId === String(usuarioId)).length,
        totalIdeias: ideias.filter((ideia) => ideia.autorId === String(usuarioId)).length,
        totalComentarios: comentarios.filter((comentario) => comentario.autorId === String(usuarioId)).length,
    };
}

function preencherTurmaDemo(turma) {
    const curso = cursos.find((item) => item.id === turma.cursoId) || null;
    return { ...turma, curso };
}

export async function listarCursos({ somenteAtivos = false } = {}) {
    if (usandoMongo()) {
        const filtro = somenteAtivos ? { ativo: true } : {};
        return Curso.find(filtro).sort({ nome: 1 }).lean();
    }
    return cursos
        .filter((curso) => !somenteAtivos || curso.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function cadastrarCurso(dados) {
    if (usandoMongo()) return Curso.create(dados);
    const curso = { id: novoId(), ativo: true, ...dados };
    cursos.push(curso);
    return curso;
}

export async function atualizarCurso(id, dados) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Curso.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    }
    const indice = cursos.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    cursos[indice] = { ...cursos[indice], ...dados };
    return cursos[indice];
}

export async function listarTurmas({ somenteAtivas = false } = {}) {
    if (usandoMongo()) {
        const filtro = somenteAtivas ? { ativo: true } : {};
        return Turma.find(filtro).populate('curso', 'nome sigla ativo').sort({ ano: -1, nome: 1 }).lean();
    }
    return turmas
        .filter((turma) => !somenteAtivas || turma.ativo)
        .map(preencherTurmaDemo)
        .sort((a, b) => b.ano - a.ano || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function cadastrarTurma(dados) {
    if (usandoMongo()) return Turma.create(dados);
    const turma = { id: novoId(), ativo: true, cursoId: String(dados.curso), ...dados };
    delete turma.curso;
    turmas.push(turma);
    return preencherTurmaDemo(turma);
}

export async function atualizarTurma(id, dados) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Turma.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    }
    const indice = turmas.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    const cursoId = dados.curso ? String(dados.curso) : turmas[indice].cursoId;
    turmas[indice] = { ...turmas[indice], ...dados, cursoId };
    delete turmas[indice].curso;
    return preencherTurmaDemo(turmas[indice]);
}

export async function resumoAdministrativo() {
    if (usandoMongo()) {
        const [totalUsuarios, totalAlunos, totalProfessores, tccsPendentes, totalCursos, totalTurmas, totalIdeias] = await Promise.all([
            Usuario.countDocuments(),
            Usuario.countDocuments({ perfil: 'aluno' }),
            Usuario.countDocuments({ perfil: 'professor' }),
            Tcc.countDocuments({ status: { $in: ['em_analise', 'correcao_solicitada'] } }),
            Curso.countDocuments(),
            Turma.countDocuments(),
            Ideia.countDocuments(),
        ]);
        return { totalUsuarios, totalAlunos, totalProfessores, tccsPendentes, totalCursos, totalTurmas, totalIdeias };
    }
    return {
        totalUsuarios: usuarios.length,
        totalAlunos: usuarios.filter((usuario) => usuario.perfil === 'aluno').length,
        totalProfessores: usuarios.filter((usuario) => usuario.perfil === 'professor').length,
        tccsPendentes: tccs.filter((tcc) => ['em_analise', 'correcao_solicitada'].includes(tcc.status)).length,
        totalCursos: cursos.length,
        totalTurmas: turmas.length,
        totalIdeias: ideias.length,
    };
}

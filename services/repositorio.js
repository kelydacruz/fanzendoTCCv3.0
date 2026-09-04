import { mongoose } from '../config/conexao.js';
import Usuario from '../models/usuario.js';
import Tcc from '../models/tcc.js';
import Ideia from '../models/ideia.js';
import Comentario from '../models/comentario.js';
import Curso from '../models/curso.js';
import Turma from '../models/turma.js';
import AreaAtuacao from '../models/areaAtuacao.js';
import Notificacao from '../models/notificacao.js';
import ConversaIdeia from '../models/conversaIdeia.js';
import MensagemIdeia from '../models/mensagemIdeia.js';
import {
    usuarios,
    tccs,
    ideias,
    comentarios,
    cursos,
    areasAtuacao,
    notificacoes,
    conversasIdeia,
    mensagensIdeia,
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
        reservadaPor: autorDemo(publicacao.reservadaPorId),
        interessados: (publicacao.interessadosIds || []).map(autorDemo).filter(Boolean),
        tccRelacionado: tccs.find((tcc) => tcc.id === publicacao.tccRelacionadoId) || null,
        ideiaOrigem: ideias.find((ideia) => ideia.id === publicacao.ideiaOrigemId) || null,
        cursoCadastro: cursos.find((curso) => curso.id === publicacao.cursoCadastroId) || null,
        turmaCadastro: publicacao.turmaCadastroId
            ? preencherTurmaDemo(turmas.find((turma) => turma.id === publicacao.turmaCadastroId))
            : null,
    };
}

function preencherConversaDemo(conversa) {
    const ideia = ideias.find((item) => item.id === conversa.ideiaId);
    return {
        ...conversa,
        ideia: ideia ? preencherPublicacaoDemo(ideia) : null,
        aluno: autorDemo(conversa.alunoId),
        autorIdeia: autorDemo(conversa.autorIdeiaId),
    };
}

function usuarioInstitucional(usuario) {
    return ['aluno', 'professor', 'admin'].includes(usuario?.perfil);
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
    usuario = null,
} = {}) {
    if (usandoMongo()) {
        const filtros = { $and: [{ $or: [{ status: 'publicado' }, { status: { $exists: false } }] }] };
        if (!usuarioInstitucional(usuario)) {
            filtros.$and.push({ $or: [{ visibilidade: 'publico' }, { visibilidade: { $exists: false } }] });
        }
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
            .populate('cursoCadastro', 'nome sigla')
            .populate('turmaCadastro', 'nome ano')
            .populate('ideiaOrigem', 'titulo origem status')
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
                && (usuarioInstitucional(usuario) || tcc.visibilidade !== 'interno')
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
            .populate('cursoCadastro', 'nome sigla')
            .populate('turmaCadastro', 'nome ano')
            .populate('ideiaOrigem', 'titulo origem status autor')
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
        orientadorId: dados.orientadorUsuario ? String(dados.orientadorUsuario) : null,
        cursoCadastroId: dados.cursoCadastro ? String(dados.cursoCadastro) : null,
        turmaCadastroId: dados.turmaCadastro ? String(dados.turmaCadastro) : null,
        ideiaOrigemId: dados.ideiaOrigem ? String(dados.ideiaOrigem) : null,
    };
    delete tcc.autor;
    delete tcc.orientadorUsuario;
    delete tcc.cursoCadastro;
    delete tcc.turmaCadastro;
    delete tcc.ideiaOrigem;
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
            .populate('cursoCadastro', 'nome sigla')
            .populate('turmaCadastro', 'nome ano')
            .populate('ideiaOrigem', 'titulo origem status')
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
    const atualizacao = { ...dados };
    if ('orientadorUsuario' in atualizacao) {
        atualizacao.orientadorId = atualizacao.orientadorUsuario ? String(atualizacao.orientadorUsuario) : null;
        delete atualizacao.orientadorUsuario;
    }
    if ('cursoCadastro' in atualizacao) {
        atualizacao.cursoCadastroId = atualizacao.cursoCadastro ? String(atualizacao.cursoCadastro) : null;
        delete atualizacao.cursoCadastro;
    }
    if ('turmaCadastro' in atualizacao) {
        atualizacao.turmaCadastroId = atualizacao.turmaCadastro ? String(atualizacao.turmaCadastro) : null;
        delete atualizacao.turmaCadastro;
    }
    if ('ideiaOrigem' in atualizacao) {
        atualizacao.ideiaOrigemId = atualizacao.ideiaOrigem ? String(atualizacao.ideiaOrigem) : null;
        delete atualizacao.ideiaOrigem;
    }
    tccs[indice] = { ...tccs[indice], ...atualizacao };
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

export async function listarIdeias({
    q = '',
    curso = '',
    status = '',
    dificuldade = '',
    origem = '',
    usuario = null,
    incluirOcultas = false,
    autorId = '',
} = {}) {
    if (usandoMongo()) {
        const filtros = {};
        if (autorId) filtros.autor = autorId;
        if (!incluirOcultas && !autorId) {
            if (usuario?.perfil === 'colaborador') filtros.autor = usuario.id || usuario._id;
            else {
                filtros.$and = [
                    { $or: [{ moderacao: 'aprovada' }, { moderacao: { $exists: false } }] },
                    { status: { $ne: 'Em desenvolvimento' } },
                ];
            }
        }
        if (q) {
            const termo = new RegExp(escaparRegex(q), 'i');
            filtros.$or = [{ titulo: termo }, { tema: termo }, { descricao: termo }];
        }
        if (curso) filtros.curso = curso;
        if (status) filtros.status = status;
        if (dificuldade) filtros.dificuldade = dificuldade;
        if (origem) filtros.origem = origem;
        return Ideia.find(filtros)
            .populate('autor', 'nome perfil curso areaAtuacao')
            .populate('reservadaPor', 'nome perfil curso')
            .populate('tccRelacionado', 'titulo visibilidade status')
            .sort({ createdAt: -1 })
            .lean();
    }

    const termo = normalizarTexto(q);
    return ideias
        .filter((ideia) => {
            const texto = normalizarTexto(`${ideia.titulo} ${ideia.tema} ${ideia.descricao}`);
            const ehAutor = autorId && ideia.autorId === String(autorId);
            const colaboradorVendoProprias = usuario?.perfil === 'colaborador'
                && ideia.autorId === String(usuario.id || usuario._id);
            const visivel = incluirOcultas || ehAutor || colaboradorVendoProprias
                || ((ideia.moderacao || 'aprovada') === 'aprovada' && ideia.status !== 'Em desenvolvimento');
            return visivel
                && (!autorId || ideia.autorId === String(autorId))
                && (!termo || texto.includes(termo))
                && (!curso || ideia.curso === curso)
                && (!status || ideia.status === status)
                && (!dificuldade || ideia.dificuldade === dificuldade)
                && (!origem || (ideia.origem || 'interna') === origem);
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(preencherPublicacaoDemo);
}

export async function buscarIdeiaPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Ideia.findById(id)
            .populate('autor', 'nome perfil curso areaAtuacao')
            .populate('interessados', 'nome perfil curso')
            .populate('reservadaPor', 'nome perfil curso')
            .populate('tccRelacionado', 'titulo visibilidade status')
            .lean();
    }
    const ideia = ideias.find((item) => item.id === String(id));
    return ideia ? preencherPublicacaoDemo(ideia) : null;
}

export async function cadastrarIdeia(dados) {
    if (usandoMongo()) return Ideia.create(dados);
    const ideia = {
        id: novoId(),
        createdAt: new Date(),
        interessadosIds: [],
        ...dados,
        autorId: String(dados.autor),
    };
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

export async function alterarModeracaoIdeia(id, moderacao) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Ideia.findByIdAndUpdate(id, { moderacao }, { new: true, runValidators: true });
    }
    return atualizarIdeia(id, { moderacao });
}

export async function registrarInteresseIdeia(id, alunoId) {
    if (usandoMongo()) {
        if (!idValido(id) || !idValido(alunoId)) return null;
        return Ideia.findOneAndUpdate(
            {
                _id: id,
                status: 'Disponível',
                $or: [{ moderacao: 'aprovada' }, { moderacao: { $exists: false } }],
            },
            { $addToSet: { interessados: alunoId } },
            { new: true },
        ).populate('autor', 'nome perfil');
    }
    const ideia = ideias.find((item) => item.id === String(id)
        && item.status === 'Disponível'
        && (item.moderacao || 'aprovada') === 'aprovada');
    if (!ideia) return null;
    ideia.interessadosIds ||= [];
    if (!ideia.interessadosIds.includes(String(alunoId))) ideia.interessadosIds.push(String(alunoId));
    return preencherPublicacaoDemo(ideia);
}

export async function buscarIdeiaReservadaPeloAluno(alunoId) {
    if (usandoMongo()) {
        if (!idValido(alunoId)) return null;
        return Ideia.findOne({ reservadaPor: alunoId, status: 'Em desenvolvimento' })
            .populate('autor', 'nome perfil')
            .lean();
    }
    const ideia = ideias.find((item) => item.reservadaPorId === String(alunoId)
        && item.status === 'Em desenvolvimento');
    return ideia ? preencherPublicacaoDemo(ideia) : null;
}

export async function reservarIdeia(id, alunoId) {
    const existente = await buscarIdeiaReservadaPeloAluno(alunoId);
    if (existente && String(existente.id || existente._id) !== String(id)) return { erro: 'ALUNO_JA_RESERVOU' };

    if (usandoMongo()) {
        if (!idValido(id) || !idValido(alunoId)) return null;
        return Ideia.findOneAndUpdate(
            {
                _id: id,
                status: 'Disponível',
                $or: [{ moderacao: 'aprovada' }, { moderacao: { $exists: false } }],
            },
            { status: 'Em desenvolvimento', reservadaPor: alunoId, $addToSet: { interessados: alunoId } },
            { new: true },
        ).populate('autor', 'nome perfil');
    }
    const ideia = ideias.find((item) => item.id === String(id)
        && item.status === 'Disponível'
        && (item.moderacao || 'aprovada') === 'aprovada');
    if (!ideia) return null;
    ideia.status = 'Em desenvolvimento';
    ideia.reservadaPorId = String(alunoId);
    ideia.interessadosIds ||= [];
    if (!ideia.interessadosIds.includes(String(alunoId))) ideia.interessadosIds.push(String(alunoId));
    return preencherPublicacaoDemo(ideia);
}

export async function liberarIdeia(id, alunoId) {
    if (usandoMongo()) {
        if (!idValido(id) || !idValido(alunoId)) return null;
        return Ideia.findOneAndUpdate(
            { _id: id, reservadaPor: alunoId, status: 'Em desenvolvimento' },
            { status: 'Disponível', reservadaPor: null },
            { new: true },
        ).populate('autor', 'nome perfil');
    }
    const ideia = ideias.find((item) => item.id === String(id)
        && item.reservadaPorId === String(alunoId)
        && item.status === 'Em desenvolvimento');
    if (!ideia) return null;
    ideia.status = 'Disponível';
    ideia.reservadaPorId = null;
    return preencherPublicacaoDemo(ideia);
}

export async function marcarIdeiaUsada(id, tccId) {
    if (!id) return null;
    if (usandoMongo()) {
        if (!idValido(id) || !idValido(tccId)) return null;
        return Ideia.findByIdAndUpdate(
            id,
            { status: 'Usada', tccRelacionado: tccId, reservadaPor: null },
            { new: true },
        ).populate('autor', 'nome perfil');
    }
    const ideia = ideias.find((item) => item.id === String(id));
    if (!ideia) return null;
    ideia.status = 'Usada';
    ideia.tccRelacionadoId = String(tccId);
    ideia.reservadaPorId = null;
    return preencherPublicacaoDemo(ideia);
}

export async function excluirIdeia(id) {
    if (usandoMongo()) {
        const conversas = await ConversaIdeia.find({ ideia: id }).select('_id').lean();
        const conversaIds = conversas.map((conversa) => conversa._id);
        await Promise.all([
            Ideia.findByIdAndDelete(id),
            Comentario.deleteMany({ alvoTipo: 'Ideia', alvo: id }),
            ConversaIdeia.deleteMany({ ideia: id }),
            MensagemIdeia.deleteMany({ conversa: { $in: conversaIds } }),
        ]);
        return;
    }
    const indice = ideias.findIndex((item) => item.id === String(id));
    if (indice >= 0) ideias.splice(indice, 1);
    for (let i = comentarios.length - 1; i >= 0; i -= 1) {
        if (comentarios[i].alvoTipo === 'ideia' && comentarios[i].alvoId === String(id)) comentarios.splice(i, 1);
    }
    const idsConversas = conversasIdeia
        .filter((conversa) => conversa.ideiaId === String(id))
        .map((conversa) => conversa.id);
    for (let i = conversasIdeia.length - 1; i >= 0; i -= 1) {
        if (conversasIdeia[i].ideiaId === String(id)) conversasIdeia.splice(i, 1);
    }
    for (let i = mensagensIdeia.length - 1; i >= 0; i -= 1) {
        if (idsConversas.includes(mensagensIdeia[i].conversaId)) mensagensIdeia.splice(i, 1);
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

export async function criarNotificacao({ destinatario, remetente = null, tipo, mensagem, link }) {
    if (!destinatario || !mensagem || !link) return null;
    if (usandoMongo()) {
        if (!idValido(destinatario)) return null;
        return Notificacao.create({ destinatario, remetente, tipo, mensagem, link });
    }
    const notificacao = {
        id: novoId(),
        destinatario: String(destinatario),
        remetente: remetente ? autorDemo(remetente) : null,
        tipo,
        mensagem,
        link,
        lida: false,
        createdAt: new Date(),
    };
    notificacoes.unshift(notificacao);
    return notificacao;
}

export async function listarNotificacoes(usuarioId, { somenteNaoLidas = false } = {}) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return [];
        const filtro = { destinatario: usuarioId };
        if (somenteNaoLidas) filtro.lida = false;
        return Notificacao.find(filtro)
            .populate('remetente', 'nome perfil')
            .sort({ createdAt: -1 })
            .lean();
    }
    return notificacoes
        .filter((item) => item.destinatario === String(usuarioId) && (!somenteNaoLidas || !item.lida))
        .map((item) => ({ ...item }));
}

export async function contarNotificacoesNaoLidas(usuarioId) {
    if (!usuarioId) return 0;
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return 0;
        return Notificacao.countDocuments({ destinatario: usuarioId, lida: false });
    }
    return notificacoes.filter((item) => item.destinatario === String(usuarioId) && !item.lida).length;
}

export async function marcarNotificacaoLida(id, usuarioId) {
    if (usandoMongo()) {
        if (!idValido(id) || !idValido(usuarioId)) return null;
        return Notificacao.findOneAndUpdate(
            { _id: id, destinatario: usuarioId },
            { lida: true },
            { new: true },
        );
    }
    const notificacao = notificacoes.find((item) => item.id === String(id) && item.destinatario === String(usuarioId));
    if (!notificacao) return null;
    notificacao.lida = true;
    return notificacao;
}

export async function marcarTodasNotificacoesLidas(usuarioId) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return;
        await Notificacao.updateMany({ destinatario: usuarioId, lida: false }, { lida: true });
        return;
    }
    notificacoes.forEach((item) => {
        if (item.destinatario === String(usuarioId)) item.lida = true;
    });
}

export async function solicitarConversaIdeia(ideiaId, alunoId) {
    const ideia = await buscarIdeiaPorId(ideiaId);
    const autorId = ideia?.autor?.id || ideia?.autor?._id || ideia?.autorId;
    const demonstrouInteresse = (ideia?.interessados || ideia?.interessadosIds || [])
        .some((interessado) => String(interessado?.id || interessado?._id || interessado) === String(alunoId));
    const reservou = String(ideia?.reservadaPor?.id || ideia?.reservadaPor?._id || ideia?.reservadaPorId || '')
        === String(alunoId);
    if (!ideia || !autorId || String(autorId) === String(alunoId)
        || (!demonstrouInteresse && !reservou)) return null;

    if (usandoMongo()) {
        if (!idValido(ideiaId) || !idValido(alunoId) || !idValido(autorId)) return null;
        let conversa = await ConversaIdeia.findOne({ ideia: ideiaId, aluno: alunoId });
        if (!conversa) {
            conversa = await ConversaIdeia.create({
                ideia: ideiaId,
                aluno: alunoId,
                autorIdeia: autorId,
                status: 'pendente',
            });
        }
        return ConversaIdeia.findById(conversa._id)
            .populate('ideia', 'titulo origem status')
            .populate('aluno', 'nome perfil curso')
            .populate('autorIdeia', 'nome perfil')
            .lean();
    }

    let conversa = conversasIdeia.find((item) => item.ideiaId === String(ideiaId)
        && item.alunoId === String(alunoId));
    if (!conversa) {
        conversa = {
            id: novoId(),
            ideiaId: String(ideiaId),
            alunoId: String(alunoId),
            autorIdeiaId: String(autorId),
            status: 'pendente',
            createdAt: new Date(),
        };
        conversasIdeia.push(conversa);
    }
    return preencherConversaDemo(conversa);
}

export async function listarConversasIdeia(usuarioId) {
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return [];
        return ConversaIdeia.find({ $or: [{ aluno: usuarioId }, { autorIdeia: usuarioId }] })
            .populate('ideia', 'titulo origem status')
            .populate('aluno', 'nome perfil curso')
            .populate('autorIdeia', 'nome perfil')
            .sort({ updatedAt: -1 })
            .lean();
    }
    return conversasIdeia
        .filter((item) => item.alunoId === String(usuarioId) || item.autorIdeiaId === String(usuarioId))
        .map(preencherConversaDemo)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

export async function buscarConversaIdeiaPorId(id) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return ConversaIdeia.findById(id)
            .populate('ideia', 'titulo origem status')
            .populate('aluno', 'nome perfil curso')
            .populate('autorIdeia', 'nome perfil')
            .lean();
    }
    const conversa = conversasIdeia.find((item) => item.id === String(id));
    return conversa ? preencherConversaDemo(conversa) : null;
}

export async function atualizarStatusConversaIdeia(id, autorIdeiaId, status) {
    if (usandoMongo()) {
        if (!idValido(id) || !idValido(autorIdeiaId)) return null;
        return ConversaIdeia.findOneAndUpdate(
            { _id: id, autorIdeia: autorIdeiaId },
            { status },
            { new: true, runValidators: true },
        ).populate('aluno', 'nome perfil curso');
    }
    const conversa = conversasIdeia.find((item) => item.id === String(id)
        && item.autorIdeiaId === String(autorIdeiaId));
    if (!conversa) return null;
    conversa.status = status;
    conversa.updatedAt = new Date();
    return preencherConversaDemo(conversa);
}

export async function listarMensagensIdeia(conversaId, usuarioId) {
    const conversa = await buscarConversaIdeiaPorId(conversaId);
    const participante = conversa
        && [conversa.aluno?.id || conversa.aluno?._id || conversa.alunoId,
            conversa.autorIdeia?.id || conversa.autorIdeia?._id || conversa.autorIdeiaId]
            .some((id) => String(id) === String(usuarioId));
    if (!participante) return null;

    if (usandoMongo()) {
        await MensagemIdeia.updateMany(
            { conversa: conversaId, autor: { $ne: usuarioId }, lida: false },
            { lida: true },
        );
        return MensagemIdeia.find({ conversa: conversaId })
            .populate('autor', 'nome perfil')
            .sort({ createdAt: 1 })
            .lean();
    }
    const resultado = mensagensIdeia.filter((item) => item.conversaId === String(conversaId));
    resultado.forEach((item) => {
        if (item.autorId !== String(usuarioId)) item.lida = true;
    });
    return resultado.map((item) => ({ ...item, autor: autorDemo(item.autorId) }));
}

export async function cadastrarMensagemIdeia(conversaId, autorId, texto) {
    const conversa = await buscarConversaIdeiaPorId(conversaId);
    const participantes = [
        conversa?.aluno?.id || conversa?.aluno?._id || conversa?.alunoId,
        conversa?.autorIdeia?.id || conversa?.autorIdeia?._id || conversa?.autorIdeiaId,
    ];
    if (!conversa || conversa.status !== 'ativa'
        || !participantes.some((id) => String(id) === String(autorId))) return null;

    if (usandoMongo()) {
        const mensagem = await MensagemIdeia.create({ conversa: conversaId, autor: autorId, texto });
        await ConversaIdeia.findByIdAndUpdate(conversaId, { updatedAt: new Date() });
        return mensagem;
    }
    const mensagem = {
        id: novoId(),
        conversaId: String(conversaId),
        autorId: String(autorId),
        texto,
        lida: false,
        createdAt: new Date(),
    };
    mensagensIdeia.push(mensagem);
    const conversaDemo = conversasIdeia.find((item) => item.id === String(conversaId));
    if (conversaDemo) conversaDemo.updatedAt = new Date();
    return { ...mensagem, autor: autorDemo(autorId) };
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
    if (!turma) return null;
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

export async function listarAreasAtuacao({ somenteAtivas = false } = {}) {
    if (usandoMongo()) {
        const filtro = somenteAtivas ? { ativo: true } : {};
        return AreaAtuacao.find(filtro).sort({ nome: 1 }).lean();
    }
    return areasAtuacao
        .filter((area) => !somenteAtivas || area.ativo)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function cadastrarAreaAtuacao(dados) {
    if (usandoMongo()) return AreaAtuacao.create(dados);
    const area = { id: novoId(), ativo: true, ...dados };
    areasAtuacao.push(area);
    return area;
}

export async function atualizarAreaAtuacao(id, dados) {
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return AreaAtuacao.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
    }
    const indice = areasAtuacao.findIndex((item) => item.id === String(id));
    if (indice < 0) return null;
    areasAtuacao[indice] = { ...areasAtuacao[indice], ...dados };
    return areasAtuacao[indice];
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
        const [totalUsuarios, totalAlunos, totalProfessores, tccsPendentes, totalCursos, totalTurmas, totalIdeias, totalAreas] = await Promise.all([
            Usuario.countDocuments(),
            Usuario.countDocuments({ perfil: 'aluno' }),
            Usuario.countDocuments({ perfil: 'professor' }),
            Tcc.countDocuments({ status: { $in: ['em_analise', 'correcao_solicitada'] } }),
            Curso.countDocuments(),
            Turma.countDocuments(),
            Ideia.countDocuments(),
            AreaAtuacao.countDocuments(),
        ]);
        return { totalUsuarios, totalAlunos, totalProfessores, tccsPendentes, totalCursos, totalTurmas, totalIdeias, totalAreas };
    }
    return {
        totalUsuarios: usuarios.length,
        totalAlunos: usuarios.filter((usuario) => usuario.perfil === 'aluno').length,
        totalProfessores: usuarios.filter((usuario) => usuario.perfil === 'professor').length,
        tccsPendentes: tccs.filter((tcc) => ['em_analise', 'correcao_solicitada'].includes(tcc.status)).length,
        totalCursos: cursos.length,
        totalTurmas: turmas.length,
        totalAreas: areasAtuacao.length,
        totalIdeias: ideias.length,
    };
}

import Usuario from '../models/usuario.js';
import { usuarios, novoId } from '../data/mock.js';
import { usandoMongo, idValido } from './banco.js';
import { normalizarTexto, escaparRegex } from './texto.js';
import { usuarioPublico } from './dadosDemo.js';

// Funções de usuarios: cada consulta usa MongoDB ou os dados locais de demonstração.
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
        filtro.removido = { $ne: true };
        return Usuario.find(filtro).sort({ nome: 1 }).lean();
    }
    const termo = normalizarTexto(q);
    return usuarios
        .filter((usuario) => !usuario.removido && (!termo || normalizarTexto(`${usuario.nome} ${usuario.email}`).includes(termo)))
        .map(usuarioPublico)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function alterarStatusUsuario(usuarioId, ativo, motivo = '') {
    if (typeof ativo !== 'boolean') return null;
    if (!ativo && (typeof motivo !== 'string' || motivo.trim().length < 5 || motivo.trim().length > 500)) return null;
    const motivoBloqueio = ativo ? '' : motivo.trim();
    if (usandoMongo()) {
        if (!idValido(usuarioId)) return null;
        return Usuario.findOneAndUpdate({ _id: usuarioId, removido: { $ne: true } }, { ativo, motivoBloqueio }, { new: true, runValidators: true });
    }
    const usuario = usuarios.find((item) => item.id === String(usuarioId));
    if (!usuario) return null;
    if (usuario.removido) return null;
    usuario.ativo = ativo;
    usuario.motivoBloqueio = motivoBloqueio;
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

export async function removerUsuarioBloqueado(id) {
    const dados = { removido: true, ativo: false };
    if (usandoMongo()) {
        if (!idValido(id)) return null;
        return Usuario.findOneAndUpdate({ _id: id, ativo: false, removido: { $ne: true }, perfil: { $ne: 'admin' } }, dados, { new: true });
    }
    const usuario = usuarios.find((item) => item.id === String(id) && item.ativo === false && !item.removido && item.perfil !== 'admin');
    if (!usuario) return null;
    Object.assign(usuario, dados);
    return usuario;
}

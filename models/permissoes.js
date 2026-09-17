export function obterId(valor) {
    return String(valor?.id || valor?._id || valor || '');
}

export function usuarioEhDono(usuario, publicacao) {
    if (!usuario || !publicacao) return false;
    return obterId(usuario) === obterId(publicacao.autor?.id || publicacao.autor?._id || publicacao.autorId);
}

export function podePublicarTcc(usuario) {
    return usuario?.perfil === 'aluno';
}

export function usuarioEhProfessor(usuario) {
    return usuario?.perfil === 'professor';
}

export function usuarioEhAdmin(usuario) {
    return usuario?.perfil === 'admin';
}

export function podeModerar(usuario) {
    return usuarioEhProfessor(usuario) || usuarioEhAdmin(usuario);
}

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

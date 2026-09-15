export function mensagemBloqueio(usuario) {
    if (usuario?.removido) return 'Esta conta foi removida pela administração. Procure a instituição para esclarecer a situação.';
    const motivo = String(usuario?.motivoBloqueio || '').trim();
    return motivo
        ? `Esta conta está bloqueada. Motivo: ${motivo} Procure a administração para esclarecer a situação.`
        : 'Esta conta está bloqueada. Procure a administração.';
}

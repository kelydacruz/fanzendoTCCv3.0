export function mensagemBloqueio(usuario) {
    const motivo = String(usuario?.motivoBloqueio || '').trim();
    return motivo
        ? `Esta conta está bloqueada. Motivo: ${motivo} Procure a administração para esclarecer a situação.`
        : 'Esta conta está bloqueada. Procure a administração.';
}
